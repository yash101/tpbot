#ifndef LLBE_INCLUDE_TRUNK_HPP
#define LLBE_INCLUDE_TRUNK_HPP

#include <config.hpp>
#include <rtc/rtc.hpp>

#include <memory>
#include <chrono>
#include <atomic>
#include <functional>

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

    inline void on_message(std::function<void(rtc::message_variant)> cb)
    {
      std::lock_guard<std::mutex> lock(ws_mutex_);
      ws_->onMessage(cb);
    }

    inline void send(rtc::message_variant& msg)
    {
      std::lock_guard<std::mutex> lock(ws_mutex_);
      if (isConnected())
        ws_->send(msg);
    }
  private:
    shared_ptr<rtc::WebSocket> ws_;
    shared_ptr<Config> config_;
    std::chrono::steady_clock::time_point last_heartbeat_;
    std::chrono::seconds eb_timeout_{1};

    std::atomic<bool> stop_{false};
    std::mutex ws_mutex_;

    const static constexpr int HEARTBEAT_INTERVAL_SEC = 5;
    const static constexpr int EB_MAX_TIMEOUT_SEC = 15;
    const static constexpr int EB_MIN_TIMEOUT_SEC = 1;
  };
}

#endif // LLBE_INCLUDE_TRUNK_HPP
