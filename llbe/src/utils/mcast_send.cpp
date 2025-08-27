// Simple multicast sender utility
// Usage examples:
//  ./mcast_send 239.255.0.1:12345 "hello world"               # send one message
//  ./mcast_send -c 10 -i eth0 239.255.0.1:12345 "burst"       # send 10 messages on iface eth0
//  ./mcast_send --join 239.255.0.1 "payload"                 # join group before sending (IGMP)
//
// Note: Sending to a multicast address does NOT require joining the group (IGMP) on most stacks.
// Joining is only required to receive multicast for that group on the host. We provide a --join
// option for testing IGMP behavior or forcing membership.

#include <arpa/inet.h>
#include <net/if.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <thread>

#include <chrono>
#include <cstring>
#include <iostream>
#include <string>

static void usage(const char *prog)
{
  std::cerr << "Usage: " << prog << " [options] <group[:port]> <message>\n"
            << "Options:\n"
            << "  -c <count>     number of times to send the message (default 1)\n"
            << "  -t <ms>        interval milliseconds between sends (default 0)\n"
            << "  -T <ttl>       multicast TTL (default 1)\n"
            << "  -i <iface>     outgoing interface name (e.g. eth0)\n"
            << "  --join         join the multicast group before sending (IGMP)\n"
            << "  --no-join      explicitly do not join (default)\n"
            << "  -h             show this help\n";
}

int main(int argc, char **argv)
{
  if (argc < 3)
  {
    usage(argv[0]);
    return 1;
  }

  int count = 1;
  int interval_ms = 0;
  int ttl = 1;
  std::string iface;
  bool join_group = false; // default: do not join (IGMP not required for sending)

  int argi = 1;
  while (argi < argc && argv[argi][0] == '-')
  {
    std::string opt = argv[argi];
    if (opt == "-c" && argi + 1 < argc)
    {
      count = std::stoi(argv[++argi]);
    }
    else if (opt == "-t" && argi + 1 < argc)
    {
      interval_ms = std::stoi(argv[++argi]);
    }
    else if (opt == "-T" && argi + 1 < argc)
    {
      ttl = std::stoi(argv[++argi]);
    }
    else if (opt == "-i" && argi + 1 < argc)
    {
      iface = argv[++argi];
    }
    else if (opt == "--join")
    {
      join_group = true;
    }
    else if (opt == "--no-join")
    {
      join_group = false;
    }
    else if (opt == "-h")
    {
      usage(argv[0]);
      return 0;
    }
    else
    {
      std::cerr << "Unknown option: " << opt << '\n';
      usage(argv[0]);
      return 1;
    }
    ++argi;
  }

  if (argi + 1 >= argc)
  {
    usage(argv[0]);
    return 1;
  }

  std::string groupArg = argv[argi++];
  std::string message = argv[argi++];

  std::string group;
  int port = 12345;
  size_t colon = groupArg.find(':');
  if (colon != std::string::npos)
  {
    group = groupArg.substr(0, colon);
    port = std::stoi(groupArg.substr(colon + 1));
  }
  else
  {
    group = groupArg;
  }

  // Resolve multicast address
  in_addr mcast_addr{};
  if (inet_pton(AF_INET, group.c_str(), &mcast_addr) != 1)
  {
    std::cerr << "Invalid IPv4 multicast address: " << group << '\n';
    return 1;
  }

  int sock = socket(AF_INET, SOCK_DGRAM, 0);
  if (sock < 0)
  {
    perror("socket");
    return 1;
  }

  // Set TTL
  if (setsockopt(sock, IPPROTO_IP, IP_MULTICAST_TTL, &ttl, sizeof(ttl)) < 0)
  {
    perror("setsockopt IP_MULTICAST_TTL");
    close(sock);
    return 1;
  }

  // Set outgoing interface if requested
  if (!iface.empty())
  {
    ifreq ifr{};
    std::strncpy(ifr.ifr_name, iface.c_str(), sizeof(ifr.ifr_name) - 1);
    if (ioctl(sock, SIOCGIFADDR, &ifr) < 0)
    {
      // SIOCGIFADDR may fail on some systems; try to use if_nametoindex + IP_MULTICAST_IF with in_addr 0
      unsigned ifindex = if_nametoindex(iface.c_str());
      if (ifindex == 0)
      {
        std::cerr << "Failed to resolve interface: " << iface << '\n';
        close(sock);
        return 1;
      }
      // Try to set by index via IP_MULTICAST_IF (some platforms do not support index form)
      in_addr addr{};
      addr.s_addr = htonl(INADDR_ANY);
      if (setsockopt(sock, IPPROTO_IP, IP_MULTICAST_IF, &addr, sizeof(addr)) < 0)
      {
        perror("setsockopt IP_MULTICAST_IF");
        close(sock);
        return 1;
      }
    }
    else
    {
      sockaddr_in *sa = reinterpret_cast<sockaddr_in *>(&ifr.ifr_addr);
      in_addr a = sa->sin_addr;
      if (setsockopt(sock, IPPROTO_IP, IP_MULTICAST_IF, &a, sizeof(a)) < 0)
      {
        perror("setsockopt IP_MULTICAST_IF");
        close(sock);
        return 1;
      }
    }
  }

  // Optionally join group (IGMP) before sending
  if (join_group)
  {
    ip_mreq mreq{};
    mreq.imr_multiaddr = mcast_addr;
    mreq.imr_interface.s_addr = htonl(INADDR_ANY);
    if (setsockopt(sock, IPPROTO_IP, IP_ADD_MEMBERSHIP, &mreq, sizeof(mreq)) < 0)
    {
      perror("setsockopt IP_ADD_MEMBERSHIP");
      close(sock);
      return 1;
    }
  }

  sockaddr_in dst{};
  dst.sin_family = AF_INET;
  dst.sin_addr = mcast_addr;
  dst.sin_port = htons(static_cast<uint16_t>(port));

  std::cout << "Sending to " << group << ":" << port << " ttl=" << ttl
            << (join_group ? " (joined)" : "") << "\n";

  for (int i = 0; i < count; ++i)
  {
    ssize_t r = sendto(sock, message.data(), message.size(), 0,
                       reinterpret_cast<sockaddr *>(&dst), sizeof(dst));
    if (r < 0)
    {
      perror("sendto");
      close(sock);
      return 1;
    }
    if (interval_ms > 0)
      std::this_thread::sleep_for(std::chrono::milliseconds(interval_ms));
  }

  close(sock);
  return 0;
}
