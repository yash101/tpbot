#ifndef LLBE_INCLUDE_TRUNK_HPP
#define LLBE_INCLUDE_TRUNK_HPP

#include <config.hpp>
#include <rtc/rtc.hpp>

#include <memory>
#include <chrono>
#include <atomic>
#include <functional>
#include <shared_mutex>

#include "logger.hpp"

using std::shared_ptr;

namespace llbe
{
  class BackendConnectivityTrunk
  {
  public:
    BackendConnectivityTrunk(shared_ptr<Config>& config);
    ~BackendConnectivityTrunk() = default;

    bool connect();
    void disconnect();
    bool isConnected() const;

    void backgroundTask();
    inline void stop() { stop_ = true; }

    inline void send(const rtc::message_variant& msg)
    {
      std::lock_guard<std::mutex> lock(ws_mutex_);
      if (isConnected())
        ws_->send(msg);
    }

    inline void addHandler(std::string type, std::function<void(const nlohmann::json&)> handler)
    {
      std::unique_lock lock(handlers_mutex_);
      handlers_[type] = handler;
    }

    inline void handle_message(rtc::message_variant msg)
    {
      if (!std::holds_alternative<std::string>(msg))
        return;

      std::string json_str = std::get<std::string>(msg);
      nlohmann::json j = nlohmann::json::parse(json_str, nullptr, false);
      if (j.is_discarded() || !j.contains("type") || !j["type"].is_string())
        return;

      std::string type = j["type"].get<std::string>();

      {
        std::shared_lock lock(handlers_mutex_);
        if (handlers_.find(type) != handlers_.end())
        {
          handlers_[type](j);
          return;
        }
      }

      Logger::getInstance().log(Logger::Level::WARNING, "No handler for message type: " + type);
    }

  private:
    shared_ptr<rtc::WebSocket> ws_;
    shared_ptr<Config> config_;

    std::shared_mutex handlers_mutex_;
    std::unordered_map<std::string, std::function<void(const nlohmann::json&)>> handlers_;

    std::chrono::steady_clock::time_point last_heartbeat_;
    std::chrono::seconds eb_timeout_{1};

    std::atomic<bool> stop_{false};
    std::mutex ws_mutex_;

    const static constexpr int HEARTBEAT_INTERVAL_SEC = 5;
    const static constexpr int EB_MAX_TIMEOUT_SEC = 15;
    const static constexpr int EB_MIN_TIMEOUT_SEC = 1;

    inline void on_message(std::function<void(rtc::message_variant)> cb)
    {
      std::lock_guard<std::mutex> lock(ws_mutex_);
      ws_->onMessage(cb);
    }
  };
}

#endif // LLBE_INCLUDE_TRUNK_HPP
