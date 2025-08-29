#include "webrtc.hpp"
#include <rtc/rtc.hpp>
#include <iostream>

llbe::WebRTCPeerConnectionFactory::WebRTCPeerConnectionFactory(shared_ptr<Config>& config) :
  config_(config)
{
  rtc::Configuration rtc_config;
  for (const auto& ice : config->webrtc.stun_servers)
    rtc_config.iceServers.emplace_back(rtc::IceServer(ice));
  
  if (rtc_config.iceServers.empty())
    rtc_config.iceServers.emplace_back("stun:stun.l.google.com:19302");

  // store configuration for later peer creation
  rtc_config_ = std::move(rtc_config);
}


void llbe::WebRTCPeerConnectionFactory::initialize(shared_ptr<Config> config)
{
  rtc::InitLogger(rtc::LogLevel::Info);
}


shared_ptr<rtc::PeerConnection> llbe::WebRTCPeerConnectionFactory::getPeerConnection()
{
  auto pc = std::make_shared<rtc::PeerConnection>(rtc_config_);
  return pc;
}

void llbe::WebRTCPeerConnectionFactory::attachTrunk(std::shared_ptr<BackendConnectivityTrunk> trunk)
{
  if (!trunk)
    return;
  trunk_ = trunk;

  // Register to receive signaling messages from the trunk. The factory
  // currently only logs them; a connection manager should parse these
  // messages and create/route PeerConnections accordingly.
  trunk_->on_message([this](rtc::message_variant msg) {
    this->onSignalingMessage(std::move(msg));
  });
}

void llbe::WebRTCPeerConnectionFactory::onSignalingMessage(rtc::message_variant msg)
{
  // message_variant usually holds either a string (JSON) or binary blob.
  try {
    if (std::holds_alternative<rtc::string>(msg)) {
      auto s = std::get<rtc::string>(msg);
      std::cout << "[webrtc factory] signaling string: " << s << std::endl;
      // TODO: parse JSON and route to/create PeerConnection instances
    } else if (std::holds_alternative<rtc::binary>(msg)) {
      auto b = std::get<rtc::binary>(msg);
      std::cout << "[webrtc factory] signaling binary size=" << b.size() << std::endl;
    } else {
      std::cout << "[webrtc factory] signaling: unknown variant" << std::endl;
    }
  } catch (const std::exception &e) {
    std::cout << "[webrtc factory] onSignalingMessage exception: " << e.what() << std::endl;
  }
}
