#pragma once

#include <string>
#include <memory>
#include <fstream>
#include <mutex>
#include <sstream>
#include <chrono>
#include <iomanip>

/**
 * Thread-safe logger for the LLBE system
 * Supports different log levels and output to file/console
 */
class Logger {
public:
    enum class Level {
        DEBUG = 0,
        INFO = 1,
        WARNING = 2,
        ERROR = 3,
        CRITICAL = 4
    };

    /**
     * Get singleton instance of logger
     * @return logger instance
     */
    static Logger& getInstance();

    /**
     * Initialize logger with file output
     * @param filename log file name
     * @param level minimum log level
     * @param console_output also output to console
     * @return true on success, false on failure
     */
    bool initialize(const std::string& filename, Level level = Level::INFO, bool console_output = true);

    /**
     * Set minimum log level
     * @param level minimum level to log
     */
    void setLevel(Level level) { 
        std::lock_guard<std::mutex> lock(mutex_);
        min_level_ = level; 
    }

    /**
     * Log a debug message
     * @param message message to log
     */
    void debug(const std::string& message);

    /**
     * Log an info message
     * @param message message to log
     */
    void info(const std::string& message);

    /**
     * Log a warning message
     * @param message message to log
     */
    void warning(const std::string& message);

    /**
     * Log an error message
     * @param message message to log
     */
    void error(const std::string& message);

    /**
     * Log a critical message
     * @param message message to log
     */
    void critical(const std::string& message);

    /**
     * Log a message with specific level
     * @param level log level
     * @param message message to log
     */
    void log(Level level, const std::string& message);

    /**
     * Flush all pending log entries
     */
    void flush();

    /**
     * Close log file
     */
    void close();

private:
    Logger() = default;
    ~Logger();

    /**
     * Convert log level to string
     * @param level log level
     * @return string representation
     */
    std::string levelToString(Level level) const;

    /**
     * Get current timestamp as string
     * @return formatted timestamp
     */
    std::string getCurrentTimestamp() const;

    /**
     * Write log entry
     * @param level log level
     * @param message message to log
     */
    void writeLog(Level level, const std::string& message);

    std::mutex mutex_;
    std::ofstream file_;
    Level min_level_ = Level::INFO;
    bool console_output_ = true;
    bool initialized_ = false;
};

// Convenience macros for logging
#define LOG_DEBUG(msg) Logger::getInstance().debug(msg)
#define LOG_INFO(msg) Logger::getInstance().info(msg)
#define LOG_WARNING(msg) Logger::getInstance().warning(msg)
#define LOG_ERROR(msg) Logger::getInstance().error(msg)
#define LOG_CRITICAL(msg) Logger::getInstance().critical(msg)
