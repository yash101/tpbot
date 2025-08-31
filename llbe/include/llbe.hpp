#ifndef LLBE_INCLUDE_LLBE_HPP
#define LLBE_INCLUDE_LLBE_HPP

#include "trunk.hpp"
#include "config.hpp"
#include <rtc/rtc.hpp>

#include <thread>
#include <mutex>
#include <shared_mutex>
#include <unordered_map>

namespace llbe
{
  class LLBE
  {
  public:
    LLBE(std::shared_ptr<Config>& config);
    ~LLBE() = default;

    void start();
    void shutdown();

    void handleMessageFromTrunk(rtc::message_variant& msg);
  
  private:
    void handleSdpMessage(const json& j);
    void handleIceCandidateMessage(const json& j);

  private:
    bool running_ = false;
    std::shared_ptr<Config> config_;

    // Connects to the backend server (TypeScript)
    llbe::BackendConnectivityTrunk trunk_;
    std::thread worker_trunk_;

    // WebRTC connections to browser clients
    std::unordered_map<
      std::string,
      std::shared_ptr<rtc::PeerConnection>
    > session_peers_;
    std::shared_mutex session_peers_mutex_;
    std::unordered_map<
      std::string,
      std::shared_ptr<rtc::DataChannel>
    > session_datachannels_;
    std::shared_mutex session_datachannels_mutex_;

    rtc::Configuration rtc_config_;
  };
}

#endif // LLBE_INCLUDE_LLBE_HPP
