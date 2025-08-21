#include <gtest/gtest.h>
#include <fstream>
#include <filesystem>
#include "config.hpp"

class ConfigTest : public ::testing::Test {
protected:
    void SetUp() override {
        test_config_file_ = "test_config.json";
    }
    
    void TearDown() override {
        if (std::filesystem::exists(test_config_file_)) {
            std::filesystem::remove(test_config_file_);
        }
    }
    
    std::string test_config_file_;
};

TEST_F(ConfigTest, CreateDefaultConfig) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    // Check default values
    EXPECT_EQ(config->server.host, "0.0.0.0");
    EXPECT_EQ(config->server.port, 8443);
    EXPECT_EQ(config->server.max_connections, 100);
    EXPECT_EQ(config->dtls.certificate_file, "cert.pem");
    EXPECT_EQ(config->dtls.private_key_file, "key.pem");
    EXPECT_EQ(config->logging.level, "info");
    EXPECT_FALSE(config->dtls.verify_client);
}

TEST_F(ConfigTest, ValidateValidConfig) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    EXPECT_TRUE(config->validate());
}

TEST_F(ConfigTest, ValidateInvalidPort) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    config->server.port = -1;
    EXPECT_FALSE(config->validate());
    
    config->server.port = 70000;
    EXPECT_FALSE(config->validate());
}

TEST_F(ConfigTest, ValidateInvalidMaxConnections) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    config->server.max_connections = 0;
    EXPECT_FALSE(config->validate());
    
    config->server.max_connections = -10;
    EXPECT_FALSE(config->validate());
}

TEST_F(ConfigTest, ValidateEmptyCertificateFile) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    config->dtls.certificate_file = "";
    EXPECT_FALSE(config->validate());
}

TEST_F(ConfigTest, ValidateInvalidLogLevel) {
    auto config = Config::createDefault();
    ASSERT_NE(config, nullptr);
    
    config->logging.level = "invalid";
    EXPECT_FALSE(config->validate());
}

TEST_F(ConfigTest, SaveAndLoadConfig) {
    // Create config with custom values
    auto original_config = Config::createDefault();
    original_config->server.port = 9999;
    original_config->server.host = "127.0.0.1";
    original_config->dtls.verify_client = true;
    original_config->logging.level = "debug";
    
    // Save to file
    EXPECT_TRUE(original_config->saveToFile(test_config_file_));
    
    // Load from file
    auto loaded_config = Config::loadFromFile(test_config_file_);
    ASSERT_NE(loaded_config, nullptr);
    
    // Verify values match
    EXPECT_EQ(loaded_config->server.port, 9999);
    EXPECT_EQ(loaded_config->server.host, "127.0.0.1");
    EXPECT_TRUE(loaded_config->dtls.verify_client);
    EXPECT_EQ(loaded_config->logging.level, "debug");
}

TEST_F(ConfigTest, LoadNonexistentFile) {
    auto config = Config::loadFromFile("nonexistent_file.json");
    EXPECT_EQ(config, nullptr);
}

TEST_F(ConfigTest, LoadInvalidJsonFile) {
    // Create invalid JSON file
    std::ofstream file(test_config_file_);
    file << "{ invalid json content";
    file.close();
    
    auto config = Config::loadFromFile(test_config_file_);
    EXPECT_EQ(config, nullptr);
}

TEST_F(ConfigTest, ToJsonString) {
    auto config = Config::createDefault();
    std::string json_str = config->toJsonString();
    
    EXPECT_FALSE(json_str.empty());
    EXPECT_NE(json_str.find("server"), std::string::npos);
    EXPECT_NE(json_str.find("dtls"), std::string::npos);
    EXPECT_NE(json_str.find("logging"), std::string::npos);
}

TEST_F(ConfigTest, PartialJsonLoad) {
    // Create JSON with only server section
    std::ofstream file(test_config_file_);
    file << R"({
        "server": {
            "port": 7777,
            "host": "192.168.1.1"
        }
    })";
    file.close();
    
    auto config = Config::loadFromFile(test_config_file_);
    ASSERT_NE(config, nullptr);
    
    // Server values should be loaded
    EXPECT_EQ(config->server.port, 7777);
    EXPECT_EQ(config->server.host, "192.168.1.1");
    
    // Other values should be defaults
    EXPECT_EQ(config->dtls.certificate_file, "cert.pem");
    EXPECT_EQ(config->logging.level, "info");
}
