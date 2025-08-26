#include <gtest/gtest.h>
#include <fstream>
#include <filesystem>
#include <thread>
#include <chrono>
#include "logger.hpp"

class LoggerTest : public ::testing::Test {
protected:
    void SetUp() override {
        test_log_file_ = "test_log.log";
    }
    
    void TearDown() override {
        Logger::getInstance().close();
        if (std::filesystem::exists(test_log_file_)) {
            std::filesystem::remove(test_log_file_);
        }
    }
    
    std::string test_log_file_;
};

TEST_F(LoggerTest, InitializeLogger) {
    bool result = Logger::getInstance().initialize(test_log_file_, Logger::Level::INFO, false);
    EXPECT_TRUE(result);
    
    EXPECT_TRUE(std::filesystem::exists(test_log_file_));
}

TEST_F(LoggerTest, LogLevels) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::DEBUG, false);
    
    Logger::getInstance().debug("Debug message");
    Logger::getInstance().info("Info message");
    Logger::getInstance().warning("Warning message");
    Logger::getInstance().error("Error message");
    Logger::getInstance().critical("Critical message");
    
    Logger::getInstance().flush();
    
    // Read log file
    std::ifstream file(test_log_file_);
    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    
    EXPECT_NE(content.find("Debug message"), std::string::npos);
    EXPECT_NE(content.find("Info message"), std::string::npos);
    EXPECT_NE(content.find("Warning message"), std::string::npos);
    EXPECT_NE(content.find("Error message"), std::string::npos);
    EXPECT_NE(content.find("Critical message"), std::string::npos);
}

TEST_F(LoggerTest, LogLevelFiltering) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::WARNING, false);
    
    Logger::getInstance().debug("Debug message");
    Logger::getInstance().info("Info message");
    Logger::getInstance().warning("Warning message");
    Logger::getInstance().error("Error message");
    
    Logger::getInstance().flush();
    
    // Read log file
    std::ifstream file(test_log_file_);
    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    
    // Should not contain debug and info messages
    EXPECT_EQ(content.find("Debug message"), std::string::npos);
    EXPECT_EQ(content.find("Info message"), std::string::npos);
    
    // Should contain warning and error messages
    EXPECT_NE(content.find("Warning message"), std::string::npos);
    EXPECT_NE(content.find("Error message"), std::string::npos);
}

TEST_F(LoggerTest, LogFormat) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::INFO, false);
    
    Logger::getInstance().info("Test message");
    Logger::getInstance().flush();
    
    // Read log file
    std::ifstream file(test_log_file_);
    std::string line;
    std::getline(file, line);
    
    // Check format: [timestamp] [level] message
    EXPECT_NE(line.find("["), std::string::npos);
    EXPECT_NE(line.find("]"), std::string::npos);
    EXPECT_NE(line.find("[INFO]"), std::string::npos);
    EXPECT_NE(line.find("Test message"), std::string::npos);
}

TEST_F(LoggerTest, ConcurrentLogging) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::INFO, false);
    
    const int num_threads = 10;
    const int messages_per_thread = 100;
    
    std::vector<std::thread> threads;
    
    for (int i = 0; i < num_threads; ++i) {
        threads.emplace_back([i, messages_per_thread]() {
            for (int j = 0; j < messages_per_thread; ++j) {
                Logger::getInstance().info("Thread " + std::to_string(i) + " Message " + std::to_string(j));
            }
        });
    }
    
    for (auto& thread : threads) {
        thread.join();
    }
    
    Logger::getInstance().flush();
    
    // Count lines in log file
    std::ifstream file(test_log_file_);
    int line_count = 0;
    std::string line;
    while (std::getline(file, line)) {
        line_count++;
    }
    
    // Should have at least the expected number of messages (plus initialization message)
    EXPECT_GE(line_count, num_threads * messages_per_thread);
}

TEST_F(LoggerTest, SetLogLevel) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::INFO, false);
    
    // Log message at info level
    Logger::getInstance().info("Info message 1");
    
    // Change to error level
    Logger::getInstance().setLevel(Logger::Level::ERROR);
    
    // These should not be logged
    Logger::getInstance().info("Info message 2");
    Logger::getInstance().warning("Warning message");
    
    // This should be logged
    Logger::getInstance().error("Error message");
    
    Logger::getInstance().flush();
    
    // Read log file
    std::ifstream file(test_log_file_);
    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    
    EXPECT_NE(content.find("Info message 1"), std::string::npos);
    EXPECT_EQ(content.find("Info message 2"), std::string::npos);
    EXPECT_EQ(content.find("Warning message"), std::string::npos);
    EXPECT_NE(content.find("Error message"), std::string::npos);
}

TEST_F(LoggerTest, MacroUsage) {
    Logger::getInstance().initialize(test_log_file_, Logger::Level::DEBUG, false);
    
    LOG_DEBUG("Debug macro");
    LOG_INFO("Info macro");
    LOG_WARNING("Warning macro");
    LOG_ERROR("Error macro");
    LOG_CRITICAL("Critical macro");
    
    Logger::getInstance().flush();
    
    // Read log file
    std::ifstream file(test_log_file_);
    std::string content((std::istreambuf_iterator<char>(file)),
                        std::istreambuf_iterator<char>());
    
    EXPECT_NE(content.find("Debug macro"), std::string::npos);
    EXPECT_NE(content.find("Info macro"), std::string::npos);
    EXPECT_NE(content.find("Warning macro"), std::string::npos);
    EXPECT_NE(content.find("Error macro"), std::string::npos);
    EXPECT_NE(content.find("Critical macro"), std::string::npos);
}
