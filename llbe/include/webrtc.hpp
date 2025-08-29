#ifndef LLBE_INCLUDE_WEBRTC_HPP
#define LLBE_INCLUDE_WEBRTC_HPP

#include <string>

#include "config.hpp"

#include <rtc/rtc.hpp>

#include "trunk.hpp"

using std::string;
using std::vector;
using std::unique_ptr;
using std::shared_ptr;

namespace llbe
{
  class WebRTCPeerConnectionFactory
  {
  public:
    WebRTCPeerConnectionFactory(shared_ptr<Config>& config);
    ~WebRTCPeerConnectionFactory() = default;

    static void initialize(shared_ptr<Config> config);

    shared_ptr<rtc::PeerConnection> getPeerConnection();

    // Attach the backend trunk (signaling) so the factory/manager can listen
    // for incoming signaling messages and route/create PeerConnections.
    void attachTrunk(std::shared_ptr<BackendConnectivityTrunk> trunk);

  private:
    shared_ptr<Config> config_;
    rtc::Configuration rtc_config_;

    // Trunk used for signaling (optional)
    std::shared_ptr<BackendConnectivityTrunk> trunk_;

    // Internal handler invoked when the trunk delivers signaling messages.
    void onSignalingMessage(rtc::message_variant msg);
  };
}

#endif // LLBE_INCLUDE_WEBRTC_HPP
