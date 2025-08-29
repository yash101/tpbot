#ifndef LLBE_INCLUDE_CONFIG_HPP
#define LLBE_INCLUDE_CONFIG_HPP

#include <string>
#include <memory>
#include <nlohmann/json.hpp>

/**
 * Configuration management for the LLBE system
 * Loads configuration from JSON files with sensible defaults
 */
class Config
{
public:
  struct ServerConfig
  {
    std::string address = "wss://be.tpbod.devya.sh:443";
    std::string password = "changeme";
  };

  struct LoggingConfig
  {
    std::string level = "info";
    std::string file = "llbe.log";
    bool console_output = true;
    bool enable_file_logging = true;
  };

  struct WebRTCConfig
  {
    std::vector<std::string> stun_servers = {"stun:stun.l.google.com:19302"};
    std::vector<std::string> turn_servers = {};
    int ice_timeout_ms = 10000;
    bool enable_datachannel = true;
  };

  /**
   * Load configuration from JSON file
   * @param filename path to configuration file
   * @return shared pointer to Config instance, nullptr on failure
   */
  static std::shared_ptr<Config> loadFromFile(const std::string &filename);

  /**
   * Create configuration with default values
   * @return shared pointer to Config instance with defaults
   */
  static std::shared_ptr<Config> createDefault();

  /**
   * Save current configuration to JSON file
   * @param filename path to save configuration
   * @return true on success, false on failure
   */
  bool saveToFile(const std::string &filename) const;

  /**
   * Validate configuration values
   * @return true if valid, false otherwise
   */
  bool validate() const;

  /**
   * Get configuration as JSON string
   * @return JSON string representation
   */
  std::string toJsonString() const;

  // Configuration sections
  ServerConfig server;
  LoggingConfig logging;
  WebRTCConfig webrtc;

private:
  Config() = default;

  /**
   * Load configuration from JSON object
   * @param json JSON object containing configuration
   */
  void fromJson(const nlohmann::json &json);

  /**
   * Convert configuration to JSON object
   * @return JSON object representation
   */
  nlohmann::json toJson() const;

  /**
   * Load server configuration section
   * @param json JSON object for server section
   */
  void loadServerConfig(const nlohmann::json &json);

  /**
   * Load logging configuration section
   * @param json JSON object for logging section
   */
  void loadLoggingConfig(const nlohmann::json &json);

  /**
   * Load WebRTC configuration section
   * @param json JSON object for WebRTC section
   */
  void loadWebRTCConfig(const nlohmann::json &json);
};

#endif // LLBE_INCLUDE_CONFIG_HPP
