#include "llbe.hpp"
#include <thread>
#include <nlohmann/json.hpp>
#include "logger.hpp"

using std::shared_ptr;
using std::string;
using nlohmann::json;

// Temporary code to allow me to bringup the robot firmware
void bodgeCode(json j)
{
  // get a connected robot (probably just one)
  int8_t power = j.value("power", 0);
  int8_t turn = j.value("turn", 0);

  int8_t left_speed = std::clamp(power + turn, -128, 127);
  int8_t right_speed = std::clamp(power - turn, -128, 127);

  // Build struct, send via UDP to robot
  
}

llbe::LLBE::LLBE(shared_ptr<Config>& config) :
  config_(config),
  trunk_(config)
{
  for (auto& ice : config_->webrtc.stun_servers)
    rtc_config_.iceServers.emplace_back(rtc::IceServer(ice));

  for (auto& ice : config_->webrtc.turn_servers)
    rtc_config_.iceServers.emplace_back(rtc::IceServer(ice));
  
  if (rtc_config_.iceServers.empty())
    rtc_config_.iceServers.emplace_back("stun:stun.l.google.com:19302");
}

void llbe::LLBE::start()
{
  if (running_)
    return;

  running_ = true;

  if (!trunk_.connect())
  {
    LOG_ERROR("Failed to connect to backend server at " + config_->server.address);
    running_ = false;
    return;
  }

  // Connect to the backend server (trunk)
  std::thread t(&llbe::BackendConnectivityTrunk::backgroundTask, &trunk_);
  worker_trunk_ = std::move(t);

  // // handle messages from the trunk
  // trunk_.on_message([this](rtc::message_variant msg) {
  //   this->handleMessageFromTrunk(msg);
  // });

  trunk_.addHandler("connection:open", [&](auto msg){
    LOG_INFO("Connected to backend server at " + config_->server.address);
    json j = {
      { "type", "user:auth" },
      { "username", "llbe" },
      { "password", config_->server.password } // TODO: use proper auth token
    };
    auto str = j.dump();
    trunk_.send(str);
    is_logged_in_ = false;
  });

  trunk_.addHandler("connection:closed", [&](auto msg){
    LOG_WARNING("Disconnected from backend server at " + config_->server.address);
    is_logged_in_ = false;
  });

  trunk_.addHandler("connection:error", [&](auto msg){
    LOG_ERROR("Connection error from backend server at " + config_->server.address + ": " + msg.value("error", "unknown error"));
    is_logged_in_ = false;
  });

  trunk_.addHandler("ping", [&](auto msg) {
    // Respond to ping
    json resp = {
      { "type", "ping:resp" },
      { "timestamp", msg.value("timestamp", 0) },
      { "incomingTimestamp", msg.value("timestamp", 0) },
      { "timestampResp", std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch()).count() }
    };
    string resp_str = resp.dump();
    rtc::message_variant resp_msg = resp_str;
    trunk_.send(resp_msg);
  });

  trunk_.addHandler("ping:resp", [&](auto msg){
    (void) msg;
    // We can just ignore ping responses for now.
  });

  trunk_.addHandler("user:auth", [&](auto msg) {
    bool success = msg.value("success", false);
    if (success)
    {
      LOG_INFO("Successfully authenticated with backend server");
      is_logged_in_ = true;
    }
    else
    {
      LOG_ERROR("Failed to authenticate with backend server: " + msg.value("error", "unknown error"));
      is_logged_in_ = false;
    }
  });

  trunk_.addHandler("webrtc:sdp", [&](auto msg) {
    handleSdpMessage(msg);
  });

  trunk_.addHandler("webrtc:ice", [&](auto msg) {
    handleIceCandidateMessage(msg);
  });

  // WebRTC isn't really working yet so just use WebSocket for control
  // Deadline for WebRTC is end of September 2025 (Ashley's housewarming prob)
  // Also WebRTC might not have significant advantages at Ashley's due to the
  // network setup (NAT, CGNAT, etc)
  trunk_.addHandler("robot:control", [&](auto msg) {
    // Control message for robot
    bodgeCode(msg);
  });
}

void llbe::LLBE::handleSdpMessage(const json& j)
{
  // Handle SDP message from trunk
  // Handle SDP message
  LOG_INFO("Received SDP message from trunk: " + j.dump());

  // Recevied SDP from trunk, forwarded from browser client
  string sessionid = j.value("sessionid", "");
  auto sdp = j["sdp"];

  // Create a new PeerConnection for this session
  shared_ptr<rtc::PeerConnection> pc =
    std::make_shared<rtc::PeerConnection>(rtc_config_);

  // Get a local SDP to send back to the client
  pc->onLocalDescription([this, sessionid](rtc::Description desc) {
    json msg = {
      { "type", "webrtc:sdp" },
      { "sessionid", sessionid },
      { "sdp", string(desc) }
    };

    string msg_str = msg.dump();
    rtc::message_variant msg_var = msg_str;
    trunk_.send(msg_var);

    LOG_INFO("Sent SDP answer to trunk: " + msg_str);
  });

  pc->onLocalCandidate([this, sessionid](rtc::Candidate candidate) {
    json msg = {
      { "type", "webrtc:ice" },
      { "candidate", candidate.candidate() },
      { "sessionid", sessionid },
      { "sdpMid", candidate.mid() },
      { "sdpMLineIndex", 0 } // assume single m-line, which is typical for LDC
    };

    LOG_INFO("Discovered local ICE candidate: " + msg.dump());
    rtc::message_variant msg_var = msg.dump();
    trunk_.send(msg_var);
  });

  // Assert that sdp.sdp exists and is a string
  if (sdp.empty() || !sdp["sdp"].is_string())
  {
    LOG_WARNING("SDP is empty in message from trunk for session " + sessionid);
    return;
  }

  // TODO: if this does not work, perhaps get sdp["sdp"] instead?
  pc->setRemoteDescription(rtc::Description(sdp["sdp"], rtc::Description::Type::Offer));
  pc->createAnswer();
  pc->onStateChange([this, sessionid](rtc::PeerConnection::State state) {
    LOG_INFO("PeerConnection state for session " + sessionid + ": " + std::to_string(static_cast<int>(state)));
    switch (state)
    {
      case rtc::PeerConnection::State::Failed:
        break;
      case rtc::PeerConnection::State::Disconnected:
        break;
      case rtc::PeerConnection::State::Closed:
        break;
      default:
        return;
    }

    // clean up connection, mutex protected, single writer
    {
      std::unique_lock lck(session_peers_mutex_);
      auto it = session_peers_.find(sessionid);
      if (it != session_peers_.end())
      {
        it->second->close();
        session_peers_.erase(it);
        LOG_INFO("PeerConnection for session " + sessionid + " closed and removed");
      }
    }
  });

  pc->onDataChannel([this, sessionid](std::shared_ptr<rtc::DataChannel> dc) {
    LOG_INFO("DataChannel opened for session " + sessionid + ", label: " + dc->label());
    std::unique_lock lck(session_datachannels_mutex_);
    if (session_datachannels_.find(sessionid) != session_datachannels_.end())
    {
      LOG_WARNING("DataChannel for session " + sessionid + " already exists, overwriting");
      session_datachannels_[sessionid]->close();
    }
    session_datachannels_[sessionid] = dc;

    dc->onMessage([sessionid](rtc::message_variant msg) {
      if (std::holds_alternative<string>(msg))
      {
        string s = std::get<string>(msg);
        LOG_INFO("DataChannel message from session " + sessionid + ": " + s);
      }
      else if (std::holds_alternative<rtc::binary>(msg))
      {
        auto b = std::get<rtc::binary>(msg);
        LOG_INFO("DataChannel binary message from session " + sessionid + ", size=" + std::to_string(b.size()));
      }
    });

    
  });

  // Store the PeerConnection (Mutex protected, single writer)
  {
    std::unique_lock lck(session_peers_mutex_);
    session_peers_[sessionid] = pc;
  }
}

void llbe::LLBE::handleIceCandidateMessage(const json& j)
{
  // Handle ICE candidate message from trunk
  // Handle ICE candidate message
  LOG_INFO("Received ICE candidate message from trunk: " + j.dump());

  string sessionid = j.value("sessionid", "");
  string candidate = j.value("candidate", "");
  string sdpMid = j.value("sdpMid", "");

  {
    std::unique_lock lck(session_peers_mutex_);
    auto it = session_peers_.find(sessionid);
    if (it == session_peers_.end())
    {
      LOG_WARNING("No PeerConnection found for session " + sessionid + " to add ICE candidate");
      return;
    }

    rtc::Candidate ice_candidate(candidate, sdpMid);
    it->second->addRemoteCandidate(ice_candidate);
    LOG_INFO("Added ICE candidate to PeerConnection for session " + sessionid);
  }
}

void llbe::LLBE::shutdown()
{
  if (!running_)
    return;

  running_ = false;

  trunk_.stop();
  std::cout << "Waiting for trunk heartbeat thread to finish...\n";
  if (worker_trunk_.joinable())
    worker_trunk_.join();
}
