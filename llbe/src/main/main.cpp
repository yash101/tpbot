#include <iostream>
#include <memory>
#include <csignal>
#include <string>
#include <getopt.h>
#include <thread>
#include <chrono>

#include "config.hpp"
#include "logger.hpp"


namespace
{
  void signalHandler(int signal)
  {
    LOG_INFO("Received signal " + std::to_string(signal) + ", shutting down...");
  }

  void printUsage(const char *program_name)
  {
    std::cout << "Usage: " << program_name << " [OPTIONS]\n"
              << "Options:\n"
              << "  -c, --config FILE    Configuration file path (default: config.json)\n"
              << "  -h, --help          Show this help message\n"
              << "  -v, --version       Show version information\n";
  }

  void printVersion()
  {
    std::cout << "Telepresence Low Latency Backend (LLBE) v1.0.0\n"
              << "Built with C++20 and libdatachannel\n";
  }
}

int main(int argc, char *argv[])
{
  std::string config_file = "config.json";

  // Parse command line arguments
  static struct option long_options[] = {
      {"config", required_argument, 0, 'c'},
      {"help", no_argument, 0, 'h'},
      {"version", no_argument, 0, 'v'},
      {0, 0, 0, 0}};

  int option_index = 0;
  int c;

  while ((c = getopt_long(argc, argv, "c:hv", long_options, &option_index)) != -1)
  {
    switch (c)
    {
    case 'c':
      config_file = optarg;
      break;
    case 'h':
      printUsage(argv[0]);
      return 0;
    case 'v':
      printVersion();
      return 0;
    case '?':
      printUsage(argv[0]);
      return 1;
    default:
      break;
    }
  }

  // Load configuration
  auto config = Config::loadFromFile(config_file);
  if (!config)
  {
    std::cerr << "Failed to load configuration from " << config_file
              << ", using defaults" << std::endl;
    config = Config::createDefault();
  }

  if (!config->validate())
  {
    std::cerr << "Invalid configuration, exiting" << std::endl;
    return 1;
  }

  // Initialize logger
  Logger::Level log_level = Logger::Level::INFO;
  if (config->logging.level == "debug")
    log_level = Logger::Level::DEBUG;
  else if (config->logging.level == "warning")
    log_level = Logger::Level::WARNING;
  else if (config->logging.level == "error")
    log_level = Logger::Level::ERROR;
  else if (config->logging.level == "critical")
    log_level = Logger::Level::CRITICAL;

  if (config->logging.enable_file_logging)
  {
    if (!Logger::getInstance().initialize(config->logging.file, log_level, config->logging.console_output))
    {
      std::cerr << "Failed to initialize logger" << std::endl;
      return 1;
    }
  }

  LOG_INFO("Starting Telepresence LLBE v1.0.0");
  LOG_INFO("Configuration loaded from: " + config_file);

  // Set up signal handlers
  std::signal(SIGINT, signalHandler);
  std::signal(SIGTERM, signalHandler);

  // Start WebRTC and UDP services

  // Cleanup
  Logger::getInstance().close();

  return 0;
}
