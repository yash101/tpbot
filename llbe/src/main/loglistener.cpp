#include <arpa/inet.h>
#include <chrono>
#include <csignal>
#include <cstring>
#include <fcntl.h>
#include <iomanip>
#include <iostream>
#include <map>
#include <netinet/in.h>
#include <sstream>
#include <string>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <vector>

#ifdef __linux__
#include <net/if.h>
#include <linux/if_packet.h>
#include <net/ethernet.h>
#include <netinet/ip.h>
#include <netinet/udp.h>
#endif

static volatile sig_atomic_t keepRunning = 1;

void handle_sigint(int)
{
  keepRunning = 0;
}

struct GroupSpec
{
  std::string addr;
  uint16_t port;
};

#ifdef __linux__
// Try to find the source MAC by reading raw link-layer frames from an AF_PACKET socket.
// This is best-effort and requires privileges. We peek through a few packets (non-blocking)
// and return the first matching frame where IPv4/UDP headers match the observed addresses/ports.
static bool match_udp_frame_and_get_mac(int packet_sock,
                                        const in_addr& want_src_ip,
                                        uint16_t want_src_port,
                                        const in_addr& want_dst_ip,
                                        uint16_t want_dst_port,
                                        std::array<uint8_t, 6>& out_mac)
{
  const int MAX_TRIES = 16;
  uint8_t buf[2048];
  for (int i = 0; i < MAX_TRIES; ++i)
  {
    ssize_t r = recvfrom(packet_sock, buf, sizeof(buf), MSG_DONTWAIT, nullptr, nullptr);
    if (r < 0)
    {
      if (errno == EWOULDBLOCK || errno == EAGAIN) return false;
      // other error: give up
      return false;
    }

    if (r < (ssize_t)(sizeof(struct ethhdr) + sizeof(struct iphdr))) continue;

    struct ethhdr* eth = reinterpret_cast<struct ethhdr*>(buf);
    uint16_t ethertype = ntohs(eth->h_proto);
    if (ethertype != ETH_P_IP) continue;

    // IP header starts after ethernet header
    struct iphdr* iph = reinterpret_cast<struct iphdr*>(buf + sizeof(struct ethhdr));
    if (iph->protocol != IPPROTO_UDP) continue;

    // ip header length in bytes
    unsigned ihl = iph->ihl * 4;
    if (r < (ssize_t)(sizeof(struct ethhdr) + ihl + sizeof(struct udphdr))) continue;

    struct udphdr* udph = reinterpret_cast<struct udphdr*>(buf + sizeof(struct ethhdr) + ihl);

    in_addr src_ip; src_ip.s_addr = iph->saddr;
    in_addr dst_ip; dst_ip.s_addr = iph->daddr;
    uint16_t src_port = ntohs(udph->source);
    uint16_t dst_port = ntohs(udph->dest);

    if (src_ip.s_addr == want_src_ip.s_addr && dst_ip.s_addr == want_dst_ip.s_addr &&
        src_port == want_src_port && dst_port == want_dst_port)
    {
      std::memcpy(out_mac.data(), eth->h_source, 6);
      return true;
    }
  }
  return false;
}
#endif

int main(int argc, char** argv)
{
  signal(SIGINT, handle_sigint);

  // Default multicast groups (change if you need different defaults)
  const uint16_t defaultPort = 12345;
  std::vector<GroupSpec> groups;

  if (argc <= 1)
  {
    // No args: use sensible defaults
    groups.push_back({"239.255.0.1", defaultPort});
    groups.push_back({"239.255.0.2", defaultPort});
  }
  else
  {
    for (int i = 1; i < argc; ++i)
    {
      std::string token = argv[i];
      std::string addr;
      uint16_t port = defaultPort;
      auto colon = token.find(':');

      if (colon != std::string::npos)
      {
        addr = token.substr(0, colon);
        std::string portStr = token.substr(colon + 1);
        int p = std::stoi(portStr);
        if (p <= 0 || p > 65535) p = defaultPort;
        port = static_cast<uint16_t>(p);
      }
      else
      {
        addr = token;
      }
      groups.push_back({addr, port});
    }
  }

  // Group by port so we can bind one socket per port
  std::map<uint16_t, int> portSocket;
  std::map<int, uint16_t> sockToPort;

#ifdef __linux__
  // Create an AF_PACKET raw socket for best-effort source MAC discovery (may require root).
  int packet_sock = socket(AF_PACKET, SOCK_RAW, htons(ETH_P_ALL));
  if (packet_sock >= 0)
  {
    // non-blocking
    int f = fcntl(packet_sock, F_GETFL, 0);
    fcntl(packet_sock, F_SETFL, f | O_NONBLOCK);
    std::cout << "AF_PACKET socket opened for MAC discovery\n";
  }
  else
  {
    packet_sock = -1;
    std::cerr << "Warning: could not open AF_PACKET socket (no MAC discovery): " << strerror(errno) << '\n';
  }
#endif

  for (const auto& g : groups)
  {
    if (portSocket.find(g.port) != portSocket.end())
      continue;

    int sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0)
    {
      std::perror("socket");
      return 1;
    }

    int reuse = 1;
    if (setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, &reuse, sizeof(reuse)) < 0)
    {
      std::perror("setsockopt SO_REUSEADDR");
      close(sock);
      return 1;
    }

    // Request destination address info via control messages
#ifdef __linux__
    { int on = 1; setsockopt(sock, IPPROTO_IP, IP_PKTINFO, &on, sizeof(on)); }
#elif defined(__APPLE__) || defined(__FreeBSD__) || defined(__OpenBSD__)
    { int on = 1; setsockopt(sock, IPPROTO_IP, IP_RECVDSTADDR, &on, sizeof(on)); }
#endif

    sockaddr_in local{};
    local.sin_family = AF_INET;
    local.sin_addr.s_addr = htonl(INADDR_ANY);
    local.sin_port = htons(g.port);

    if (bind(sock, reinterpret_cast<sockaddr*>(&local), sizeof(local)) < 0)
    {
      std::perror("bind");
      close(sock);
      return 1;
    }

    // Set non-blocking so select works predictably
    int flags = fcntl(sock, F_GETFL, 0);
    fcntl(sock, F_SETFL, flags | O_NONBLOCK);

    portSocket[g.port] = sock;
    sockToPort[sock] = g.port;
  }

  // Join multicast groups
  for (const auto& g : groups)
  {
    int sock = portSocket[g.port];
    ip_mreq mreq{};
    if (inet_pton(AF_INET, g.addr.c_str(), &mreq.imr_multiaddr) != 1)
    {
      std::cerr << "Invalid multicast address: " << g.addr << '\n';
      continue;
    }

    mreq.imr_interface.s_addr = htonl(INADDR_ANY);
    if (setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0)
    {
      std::cerr << "Failed to join group " << g.addr << ":" << g.port << " - ";
      std::perror("");
    }
    else
    {
      std::cout << "Joined " << g.addr << ":" << g.port << " on socket " << sock << '\n';
    }
  }

  // Prepare for select
  fd_set readfds;
  int maxfd = -1;
  std::vector<int> socks;
  for (auto& kv : portSocket)
  {
    socks.push_back(kv.second);
    maxfd = std::max(maxfd, kv.second);
  }

  // 10kB is a bigger packet supported by my switches and shit
  char iov_recvbuf[10000];
  // Control buffer data
  char ctrl_buf[512];

  std::cout << "Listening for multicast logs. Press Ctrl-C to exit.\n";

  while (keepRunning)
  {
    // SELECT to await any socket being ready
    FD_ZERO(&readfds);
    for (int s : socks)
      FD_SET(s, &readfds);

    timeval tv{};
    tv.tv_sec = 1; // wake up every second to check signal
    tv.tv_usec = 0;

    int ready = select(maxfd + 1, &readfds, nullptr, nullptr, &tv);
    if (ready < 0)
    {
      int err = errno;
      if (err == EINTR)
        continue;

      std::cerr << "select: " << strerror(err) << '\n';
      break;
    }

    int ready_socket = -1;

    // Get the correct fd
    for (int s : socks)
    {
      if (FD_ISSET(s, &readfds))
      {
        ready_socket = s;
        break;
      }
    }

    if (ready_socket == -1)
      continue;

    // Receieve the message using recvmsg to get control data
    struct iovec iov =
    {
      .iov_base = iov_recvbuf,
      .iov_len = sizeof(iov_recvbuf),
    };
    struct sockaddr_storage src_addr;
    struct msghdr msg = {
      .msg_name = &src_addr,
      .msg_namelen = sizeof(src_addr),
      .msg_iov = &iov,
      .msg_iovlen = 1,
      .msg_control = ctrl_buf,
      .msg_controllen = sizeof(ctrl_buf),
    };

    // Receive the message
    ssize_t n = recvmsg(ready_socket, &msg, MSG_TRUNC);
    if (n < 0)
    {
      int err = errno;
      if (err == EWOULDBLOCK || err == EAGAIN)
        continue;

      std::cerr << "recvmsg: " << strerror(err) << '\n';
      continue;
    }
    else if (n >= sizeof(iov_recvbuf))
    {
      std::cerr << "Warning: received message truncated, size " << n << " bytes\n";
      iov_recvbuf[sizeof(iov_recvbuf) - 1] = '\0';
    }

    // Source IP/port
    char src_ip_str[INET_ADDRSTRLEN] = "?";
    uint16_t src_port = 0;
    if (src_addr.ss_family == AF_INET)
    {
      struct sockaddr_in* s4 = reinterpret_cast<struct sockaddr_in*>(&src_addr);
      inet_ntop(AF_INET, &s4->sin_addr, src_ip_str, sizeof(src_ip_str));
      src_port = ntohs(s4->sin_port);
    }

    // Destination IP (from ancillary) and destination port (local bound port)
    char dst_ip_str[INET_ADDRSTRLEN] = "?";
    bool have_dst = false;

    for (struct cmsghdr* c = CMSG_FIRSTHDR(&msg); c; c = CMSG_NXTHDR(&msg, c))
    {
      if (c->cmsg_level == IPPROTO_IP)
      {
#ifdef IP_PKTINFO
        if (c->cmsg_type == IP_PKTINFO)
        {
          in_pktinfo* pi = reinterpret_cast<in_pktinfo*>(CMSG_DATA(c));
          inet_ntop(AF_INET, &pi->ipi_addr, dst_ip_str, sizeof(dst_ip_str));
          have_dst = true;
        }
#endif
#ifdef IP_RECVDSTADDR
        if (c->cmsg_type == IP_RECVDSTADDR)
        {
          in_addr* a = reinterpret_cast<in_addr*>(CMSG_DATA(c));
          inet_ntop(AF_INET, a, dst_ip_str, sizeof(dst_ip_str));
          have_dst = true;
        }
#endif
      }
    }

    uint16_t dst_port = sockToPort[ready_socket];

    // Try to obtain source MAC when possible (Linux AF_PACKET)
    std::string src_mac_str = "N/A";
#ifdef __linux__
    if (packet_sock >= 0 && src_addr.ss_family == AF_INET && have_dst)
    {
      in_addr want_src, want_dst;
      inet_pton(AF_INET, src_ip_str, &want_src);
      inet_pton(AF_INET, dst_ip_str, &want_dst);
      std::array<uint8_t, 6> mac;
      bool ok = match_udp_frame_and_get_mac(packet_sock, want_src, src_port, want_dst, dst_port, mac);
      if (ok)
      {
        char macbuf[18];
        std::snprintf(macbuf, sizeof(macbuf), "%02x:%02x:%02x:%02x:%02x:%02x",
                      mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
        src_mac_str = macbuf;
      }
    }
#endif

    // Null-terminate payload for printing (careful: message may contain NULs)
    size_t printed_len = (n >= 0 && n < (ssize_t)sizeof(iov_recvbuf)) ? (size_t)n : (sizeof(iov_recvbuf) - 1);
    iov_recvbuf[printed_len] = '\0';

    // Timestamp
    auto now = std::chrono::system_clock::now();
    auto t = std::chrono::system_clock::to_time_t(now);

    std::ostringstream oss;
    oss << std::put_time(std::localtime(&t), "%F %T")
        << " [dst=" << (have_dst ? dst_ip_str : "?") << ":" << dst_port << "]"
        << " [src=" << src_ip_str << ":" << src_port << "]"
        << " [src-mac=" << src_mac_str << "] "
        << '"' << iov_recvbuf << '"';

    std::cout << oss.str() << std::endl;
  }

  std::cout << "Shutting down...\n";
  // Leave groups and close sockets
  for (const auto& g : groups) {
    int sock = portSocket[g.port];
    ip_mreq mreq{};
    if (inet_pton(AF_INET, g.addr.c_str(), &mreq.imr_multiaddr) == 1) {
      mreq.imr_interface.s_addr = htonl(INADDR_ANY);
      setsockopt(sock, IPPROTO_IP, IP_DROP_MEMBERSHIP, &mreq, sizeof(mreq));
    }
  }

  for (auto& kv : portSocket) close(kv.second);
#ifdef __linux__
  if (packet_sock >= 0) close(packet_sock);
#endif

  return 0;
}