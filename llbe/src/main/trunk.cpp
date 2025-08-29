#include "trunk.hpp"
#include "logger.hpp"

#include <nlohmann/json.hpp>

using nlohmann::json;

llbe::BackendConnectivityTrunk::BackendConnectivityTrunk(shared_ptr<Config>& config) :
  config_(config)
{
  // Initialize WebSocket connection here using config parameters
  ws_ = std::make_shared<rtc::WebSocket>(config->server.address);
}

bool llbe::BackendConnectivityTrunk::connect()
{
  std::lock_guard<std::mutex> lock(ws_mutex_);

  if (!ws_)
  {
    Logger::getInstance().log(Logger::Level::ERROR, "WebSocket not initialized");
    ws_ = std::make_shared<rtc::WebSocket>(config_->server.address);
  }

  if (ws_->isOpen())
    return true;

  ws_->onOpen([this]() {
    Logger::getInstance().log(Logger::Level::INFO, "WebSocket connection opened");
    json j = {
      { "type", "register" },
      { "role", "llbe" },
      { "token", config_->server.address } // TODO: use proper auth token
    };

    std::lock_guard<std::mutex> lock(ws_mutex_);
    ws_->send(j.dump());
  });

  ws_->onClosed([this]() {
    Logger::getInstance().log(Logger::Level::WARNING, "WebSocket connection closed");
  });

  ws_->onError([this](std::string error) {
    Logger::getInstance().log(Logger::Level::ERROR, "WebSocket error: " + error);
  });

  ws_->open(config_->server.address);
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
      ws_->send("{\"type\":\"heartbeat\"}");
    }
    
    eb_timeout_ = std::chrono::seconds(EB_MIN_TIMEOUT_SEC);
    std::this_thread::sleep_for(std::chrono::seconds(eb_timeout_.count()));
  }
}
