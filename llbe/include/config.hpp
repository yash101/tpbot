#ifndef LLBE_INCLUDE_CONFIG_HPP
#define LLBE_INCLUDE_CONFIG_HPP

#include <string>
#include <memory>
#include <nlohmann/json.hpp>

/**
 * Configuration management for the LLBE system
 * Loads configuration from JSON files with sensible defaults
 */
class Config {
public:
  struct ServerConfig {
    std::string host = "0.0.0.0";
    int port = 8443;
    int max_connections = 100;
    int thread_pool_size = 4;
    int socket_timeout_ms = 30000;
    int keep_alive_interval_ms = 60000;
  };

  struct DTLSConfig {
    std::string certificate_file = "cert.pem";
    std::string private_key_file = "key.pem";
    bool verify_client = false;
    std::string cipher_list = "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS";
    int handshake_timeout_ms = 10000;
  };

  struct LoggingConfig {
    std::string level = "info";
    std::string file = "llbe.log";
    bool console_output = true;
    bool enable_file_logging = true;
  };

  struct WebRTCConfig {
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
  static std::shared_ptr<Config> loadFromFile(const std::string& filename);

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
  bool saveToFile(const std::string& filename) const;

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
  DTLSConfig dtls;
  LoggingConfig logging;
  WebRTCConfig webrtc;

private:
  Config() = default;

  /**
   * Load configuration from JSON object
   * @param json JSON object containing configuration
   */
  void fromJson(const nlohmann::json& json);

  /**
   * Convert configuration to JSON object
   * @return JSON object representation
   */
  nlohmann::json toJson() const;

  /**
   * Load server configuration section
   * @param json JSON object for server section
   */
  void loadServerConfig(const nlohmann::json& json);

  /**
   * Load DTLS configuration section
   * @param json JSON object for DTLS section
   */
  void loadDTLSConfig(const nlohmann::json& json);

  /**
   * Load logging configuration section
   * @param json JSON object for logging section
   */
  void loadLoggingConfig(const nlohmann::json& json);

  /**
   * Load WebRTC configuration section
   * @param json JSON object for WebRTC section
   */
  void loadWebRTCConfig(const nlohmann::json& json);
};

#endif // LLBE_INCLUDE_CONFIG_HPP
