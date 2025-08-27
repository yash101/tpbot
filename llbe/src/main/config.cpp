#include "config.hpp"
#include "logger.hpp"

#include <fstream>
#include <iostream>

using json = nlohmann::json;

std::shared_ptr<Config> Config::loadFromFile(const std::string &filename)
{
  try
  {
    std::ifstream file(filename);
    if (!file.is_open())
    {
      std::cerr << "Could not open config file: " << filename << std::endl;
      return nullptr;
    }

    json j;
    file >> j;

    auto config = std::shared_ptr<Config>(new Config());
    config->fromJson(j);

    return config;
  }
  catch (const std::exception &e)
  {
    std::cerr << "Error loading config: " << e.what() << std::endl;
    return nullptr;
  }
}

std::shared_ptr<Config> Config::createDefault()
{
  return std::shared_ptr<Config>(new Config());
}

bool Config::saveToFile(const std::string &filename) const
{
  try
  {
    std::ofstream file(filename);
    if (!file.is_open())
    {
      LOG_ERROR("Could not open config file for writing: " + filename);
      return false;
    }

    json j = toJson();
    file << j.dump(4) << std::endl;

    return true;
  }
  catch (const std::exception &e)
  {
    LOG_ERROR("Error saving config: " + std::string(e.what()));
    return false;
  }
}

bool Config::validate() const
{
  // Validate server configuration
  if (server.port <= 0 || server.port > 65535)
  {
    LOG_ERROR("Invalid server port: " + std::to_string(server.port));
    return false;
  }

  if (server.max_connections <= 0)
  {
    LOG_ERROR("Invalid max_connections: " + std::to_string(server.max_connections));
    return false;
  }

  if (server.thread_pool_size <= 0)
  {
    LOG_ERROR("Invalid thread_pool_size: " + std::to_string(server.thread_pool_size));
    return false;
  }

  // Validate logging configuration
  if (logging.level != "debug" && logging.level != "info" &&
      logging.level != "warning" && logging.level != "error" &&
      logging.level != "critical")
  {
    LOG_ERROR("Invalid logging level: " + logging.level);
    return false;
  }

  return true;
}

std::string Config::toJsonString() const
{
  return toJson().dump(4);
}

void Config::fromJson(const json &j)
{
  if (j.contains("server"))
  {
    loadServerConfig(j["server"]);
  }

  if (j.contains("logging"))
  {
    loadLoggingConfig(j["logging"]);
  }

  if (j.contains("webrtc"))
  {
    loadWebRTCConfig(j["webrtc"]);
  }
}

json Config::toJson() const
{
  json j;

  // Server configuration
  j["server"]["host"] = server.host;
  j["server"]["port"] = server.port;
  j["server"]["max_connections"] = server.max_connections;
  j["server"]["thread_pool_size"] = server.thread_pool_size;
  j["server"]["socket_timeout_ms"] = server.socket_timeout_ms;
  j["server"]["keep_alive_interval_ms"] = server.keep_alive_interval_ms;

  // Logging configuration
  j["logging"]["level"] = logging.level;
  j["logging"]["file"] = logging.file;
  j["logging"]["console_output"] = logging.console_output;
  j["logging"]["enable_file_logging"] = logging.enable_file_logging;

  // WebRTC configuration
  j["webrtc"]["stun_servers"] = webrtc.stun_servers;
  j["webrtc"]["turn_servers"] = webrtc.turn_servers;
  j["webrtc"]["ice_timeout_ms"] = webrtc.ice_timeout_ms;
  j["webrtc"]["enable_datachannel"] = webrtc.enable_datachannel;

  return j;
}

void Config::loadServerConfig(const json &j)
{
  if (j.contains("host"))
  {
    server.host = j["host"];
  }
  if (j.contains("port"))
  {
    server.port = j["port"];
  }
  if (j.contains("max_connections"))
  {
    server.max_connections = j["max_connections"];
  }
  if (j.contains("thread_pool_size"))
  {
    server.thread_pool_size = j["thread_pool_size"];
  }
  if (j.contains("socket_timeout_ms"))
  {
    server.socket_timeout_ms = j["socket_timeout_ms"];
  }
  if (j.contains("keep_alive_interval_ms"))
  {
    server.keep_alive_interval_ms = j["keep_alive_interval_ms"];
  }
}

void Config::loadLoggingConfig(const json &j)
{
  if (j.contains("level"))
  {
    logging.level = j["level"];
  }
  if (j.contains("file"))
  {
    logging.file = j["file"];
  }
  if (j.contains("console_output"))
  {
    logging.console_output = j["console_output"];
  }
  if (j.contains("enable_file_logging"))
  {
    logging.enable_file_logging = j["enable_file_logging"];
  }
}

void Config::loadWebRTCConfig(const json &j)
{
  if (j.contains("stun_servers"))
  {
    webrtc.stun_servers = j["stun_servers"];
  }
  if (j.contains("turn_servers"))
  {
    webrtc.turn_servers = j["turn_servers"];
  }
  if (j.contains("ice_timeout_ms"))
  {
    webrtc.ice_timeout_ms = j["ice_timeout_ms"];
  }
  if (j.contains("enable_datachannel"))
  {
    webrtc.enable_datachannel = j["enable_datachannel"];
  }
}
