#include <udp.hpp>
#include <logger.hpp>
#include <unistd.h> // for close()
#include <cstring>
#include <fcntl.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <iostream>

llbe::RobotUDPSession::~RobotUDPSession()
{
  if (sockfd_ >= 0)
  {
    close(sockfd_);
    LOG_INFO("Closed UDP socket on " + bind_address_ + ":" + std::to_string(bind_port_));
  }
}

void llbe::RobotUDPSession::send_message(const std::string& message)
{
  if (sockfd_ < 0)
  {
    LOG_ERROR("Attempted to send on invalid UDP socket");
    return;
  }

  struct iovec iov{
    .iov_base = const_cast<char*>(message.data()),
    .iov_len = message.size()
  };

  // Build packet to send
  struct msghdr msg{
    .msg_iov = &iov,
    .msg_iovlen = 1,
    .msg_name = nullptr
  };

  sendmsg(sockfd_, nullptr, 0); // Dummy call to suppress unused parameter warning

  // if (sent_bytes < 0)
  // {
  //   LOG_ERROR("Failed to send UDP message: " + std::string(std::strerror(errno)));
  // }
}
