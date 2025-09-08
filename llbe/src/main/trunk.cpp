#include "trunk.hpp"
#include "logger.hpp"

#include <nlohmann/json.hpp>

using nlohmann::json;

llbe::BackendConnectivityTrunk::BackendConnectivityTrunk(shared_ptr<Config>& config) :
  config_(config)
{
  // Initialize WebSocket connection here using config parameters
  ws_ = std::make_shared<rtc::WebSocket>();
  ws_->close();
  ws_->open(config_->server.address);
  std::cout << "WebSocket initialized to " << config_->server.address << std::endl;
}

bool llbe::BackendConnectivityTrunk::connect()
{
  std::lock_guard<std::mutex> lock(ws_mutex_);

  if (!ws_ || ws_->isClosed())
  {
    Logger::getInstance().log(Logger::Level::ERROR, "WebSocket not initialized");
    ws_ = std::make_shared<rtc::WebSocket>();
    ws_->open(config_->server.address);
  }

  if (ws_->isOpen())
    return true;

  ws_->onOpen([this]() {
    json msg = {
      {"type", "connection:open"},
    };
    handle_message(msg.dump());
  });

  ws_->onClosed([this]() {
    json msg = {
      "type", "connection:closed"      
    };
    Logger::getInstance().log(Logger::Level::WARNING, "WebSocket connection closed");
    handle_message(msg.dump());
  });

  ws_->onError([this](std::string error) {
    json msg = {
      "type", "connection:error",
      "error", error
    };
    Logger::getInstance().log(Logger::Level::ERROR, "WebSocket error: " + error);
    handle_message(msg.dump());
  });

  ws_->onMessage([this](rtc::message_variant msg) {
    handle_message(msg);
  });

  return true;
}

void llbe::BackendConnectivityTrunk::disconnect()
{
  std::lock_guard<std::mutex> lock(ws_mutex_);
  if (!ws_ || !ws_->isOpen())
  {
    Logger::getInstance().log(Logger::Level::INFO, "WebSocket close() already was disconnected");
    return;
  }

  ws_->close();
  Logger::getInstance().log(Logger::Level::INFO, "WebSocket connection closed by client");
}

bool llbe::BackendConnectivityTrunk::isConnected() const
{
  return ws_ && ws_->isOpen();
}

void llbe::BackendConnectivityTrunk::backgroundTask()
{
  // Sleep initially otherwise we'll have a tiny race condition and it'll think the connection
  // is down and try to reconnect immediately. The code is actually thread safe and this isn't
  // rlly a problem but the logs become confusing
  std::this_thread::sleep_for(std::chrono::seconds(EB_MAX_TIMEOUT_SEC));
  while (true)
  {
    if (stop_)
    {
      disconnect();
      break;
    }

    // Exponential backoff for reconnection attempts
    if (!isConnected())
    {
      this->connect();
      std::this_thread::sleep_for(std::chrono::seconds(eb_timeout_.count()));
      eb_timeout_ = std::min(eb_timeout_ * 2, std::chrono::seconds(EB_MAX_TIMEOUT_SEC));
      LOG_ERROR("WebSocket not connected, retrying in " +
        std::to_string(eb_timeout_.count()) + " seconds");

      continue;
    }

    if (isConnected())
    {
      std::lock_guard<std::mutex> lock(ws_mutex_);
      json j = {
        { "type", "ping" }
      };
      ws_->send(j.dump());
    }
    
    eb_timeout_ = std::chrono::seconds(EB_MIN_TIMEOUT_SEC);
    std::this_thread::sleep_for(std::chrono::seconds(eb_timeout_.count()));
  }
}
