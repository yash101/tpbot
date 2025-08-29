#ifndef LLBE_INCLUDE_UDP_HPP
#define LLBE_INCLUDE_UDP_HPP

#include <string>
#include <cstdint>
#include <chrono>
#include <functional>

namespace llbe
{
  class RobotUDPSession
  {
  private:
    int sockfd_;
    std::string bind_address_;
    uint16_t bind_port_;
    std::chrono::time_point<std::chrono::steady_clock> last_hb_;

  public:
    inline RobotUDPSession(int fd, const std::string &address, uint16_t port) :
      sockfd_(fd),
      bind_address_(address),
      bind_port_(port),
      last_hb_(std::chrono::steady_clock::now())
    { }

    virtual ~RobotUDPSession();

    void send_message(const std::string& message);
    void on_message(std::function<void(const std::string&)> callback);
    void backgroundTask();
  };
}

#endif // LLBE_INCLUDE_UDP_HPP
