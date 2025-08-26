#include "logger.hpp"
#include <iostream>

Logger& Logger::getInstance() {
    static Logger instance;
    return instance;
}

Logger::~Logger() {
    close();
}

bool Logger::initialize(const std::string& filename, Level level, bool console_output) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (initialized_) {
        return true;
    }
    
    min_level_ = level;
    console_output_ = console_output;
    
    file_.open(filename, std::ios::app);
    if (!file_.is_open()) {
        if (console_output_) {
            std::cerr << "Failed to open log file: " << filename << std::endl;
        }
        return false;
    }
    
    initialized_ = true;
    
    // Log initialization message
    writeLog(Level::INFO, "Logger initialized - Level: " + levelToString(level) + 
             ", File: " + filename + ", Console: " + (console_output ? "yes" : "no"));
    
    return true;
}

void Logger::debug(const std::string& message) {
    log(Level::DEBUG, message);
}

void Logger::info(const std::string& message) {
    log(Level::INFO, message);
}

void Logger::warning(const std::string& message) {
    log(Level::WARNING, message);
}

void Logger::error(const std::string& message) {
    log(Level::ERROR, message);
}

void Logger::critical(const std::string& message) {
    log(Level::CRITICAL, message);
}

void Logger::log(Level level, const std::string& message) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (level >= min_level_) {
        writeLog(level, message);
    }
}

void Logger::flush() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (file_.is_open()) {
        file_.flush();
    }
}

void Logger::close() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (file_.is_open()) {
        writeLog(Level::INFO, "Logger shutting down");
        file_.close();
    }
    initialized_ = false;
}

std::string Logger::levelToString(Level level) const {
    switch (level) {
        case Level::DEBUG:    return "DEBUG";
        case Level::INFO:     return "INFO";
        case Level::WARNING:  return "WARN";
        case Level::ERROR:    return "ERROR";
        case Level::CRITICAL: return "CRIT";
        default:              return "UNKNOWN";
    }
}

std::string Logger::getCurrentTimestamp() const {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(
        now.time_since_epoch()) % 1000;
    
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time_t), "%Y-%m-%d %H:%M:%S");
    ss << '.' << std::setfill('0') << std::setw(3) << ms.count();
    
    return ss.str();
}

void Logger::writeLog(Level level, const std::string& message) {
    std::string timestamp = getCurrentTimestamp();
    std::string level_str = levelToString(level);
    
    std::stringstream log_entry;
    log_entry << "[" << timestamp << "] [" << level_str << "] " << message;
    
    std::string log_line = log_entry.str();
    
    // Write to file
    if (file_.is_open()) {
        file_ << log_line << std::endl;
        file_.flush();
    }
    
    // Write to console
    if (console_output_) {
        if (level >= Level::ERROR) {
            std::cerr << log_line << std::endl;
        } else {
            std::cout << log_line << std::endl;
        }
    }
}
