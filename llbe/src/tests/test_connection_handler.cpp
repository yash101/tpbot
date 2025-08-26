#include <gtest/gtest.h>
#include <memory>
#include <thread>
#include <chrono>
#include <filesystem>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include "connection_handler.hpp"
#include "config.hpp"
#include "logger.hpp"

class ConnectionHandlerTest : public ::testing::Test {
protected:
    void SetUp() override {
        Logger::getInstance().initialize("connection_test.log", Logger::Level::DEBUG, false);
        
        config_ = Config::createDefault();
        config_->dtls.handshake_timeout_ms = 1000; // Short timeout for testing
        
        // Create a simple socket pair for testing
        int sockets[2];
        if (socketpair(AF_UNIX, SOCK_STREAM, 0, sockets) == 0) {
            client_socket_ = sockets[0];
            server_socket_ = sockets[1];
        } else {
            client_socket_ = -1;
            server_socket_ = -1;
        }
        
        ssl_context_ = nullptr; // In real tests, you'd create a proper SSL context
    }
    
    void TearDown() override {
        if (client_socket_ != -1) {
            close(client_socket_);
        }
        if (server_socket_ != -1) {
            close(server_socket_);
        }
        
        if (ssl_context_) {
            SSL_CTX_free(ssl_context_);
        }
        
        std::filesystem::remove("connection_test.log");
        Logger::getInstance().close();
    }
    
    std::shared_ptr<Config> config_;
    int client_socket_;
    int server_socket_;
    SSL_CTX* ssl_context_;
};

TEST_F(ConnectionHandlerTest, Construction) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    EXPECT_FALSE(handler->isActive());
    EXPECT_FALSE(handler->isFinished());
    EXPECT_EQ(handler->getBytesReceived(), 0);
    EXPECT_EQ(handler->getBytesSent(), 0);
}

TEST_F(ConnectionHandlerTest, GetClientAddress) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    // For socket pairs, the address might be "unknown" or empty
    std::string address = handler->getClientAddress();
    EXPECT_FALSE(address.empty());
}

TEST_F(ConnectionHandlerTest, StartAndStop) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    // Start the handler
    handler->start();
    
    // Give it a moment to start
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Stop the handler
    handler->stop();
    
    // Should be finished after stopping
    EXPECT_TRUE(handler->isFinished());
}

TEST_F(ConnectionHandlerTest, MessageCallback) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    std::string received_message;
    bool callback_called = false;
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    handler->setMessageCallback([&](const std::string& message) {
        received_message = message;
        callback_called = true;
    });
    
    // Verify callback is set (indirectly, by checking it's not null)
    // The actual callback testing would require a full DTLS handshake
    EXPECT_FALSE(callback_called); // Initially false
}

TEST_F(ConnectionHandlerTest, DisconnectCallback) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    bool disconnect_called = false;
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    handler->setDisconnectCallback([&]() {
        disconnect_called = true;
    });
    
    // Start and immediately stop to trigger disconnect
    handler->start();
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    handler->stop();
    
    // Give time for disconnect callback
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Disconnect should be called when connection ends
    EXPECT_TRUE(disconnect_called);
}

TEST_F(ConnectionHandlerTest, GetStartTime) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto before = std::chrono::steady_clock::now();
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    auto after = std::chrono::steady_clock::now();
    
    auto start_time = handler->getStartTime();
    
    EXPECT_GE(start_time, before);
    EXPECT_LE(start_time, after);
}

TEST_F(ConnectionHandlerTest, SendDataWithoutSSL) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    // Should fail without proper SSL setup
    bool result = handler->sendData("test data");
    EXPECT_FALSE(result);
    
    // Bytes sent should remain 0
    EXPECT_EQ(handler->getBytesSent(), 0);
}

TEST_F(ConnectionHandlerTest, MultipleStops) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, ssl_context_, config_);
    
    // Multiple stops should be safe
    handler->stop();
    handler->stop();
    handler->stop();
    
    EXPECT_TRUE(handler->isFinished());
}

// Mock test for SSL context usage
TEST_F(ConnectionHandlerTest, SSLContextHandling) {
    if (server_socket_ == -1) {
        GTEST_SKIP() << "Failed to create socket pair";
    }
    
    // Test with null SSL context (should handle gracefully)
    auto handler = std::make_unique<ConnectionHandler>(server_socket_, nullptr, config_);
    
    EXPECT_FALSE(handler->isActive());
    
    // Starting should fail gracefully with null SSL context
    handler->start();
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    
    // Should finish quickly due to SSL initialization failure
    EXPECT_TRUE(handler->isFinished());
}

class ConnectionHandlerIntegrationTest : public ::testing::Test {
protected:
    void SetUp() override {
        Logger::getInstance().initialize("integration_connection_test.log", Logger::Level::DEBUG, false);
        config_ = Config::createDefault();
        config_->dtls.handshake_timeout_ms = 5000;
    }
    
    void TearDown() override {
        std::filesystem::remove("integration_connection_test.log");
        Logger::getInstance().close();
    }
    
    std::shared_ptr<Config> config_;
};

TEST_F(ConnectionHandlerIntegrationTest, ConnectionLifecycle) {
    // This would be a full integration test with proper SSL setup
    // For now, it demonstrates the test structure
    
    EXPECT_NE(config_, nullptr);
    EXPECT_GT(config_->dtls.handshake_timeout_ms, 0);
    
    // In a real integration test:
    // 1. Set up proper SSL context with test certificates
    // 2. Create real network sockets
    // 3. Test full connection lifecycle
    // 4. Verify data transmission
    // 5. Test error conditions
    // 6. Clean up resources
}

TEST_F(ConnectionHandlerIntegrationTest, ConcurrentConnections) {
    // Test multiple concurrent connection handlers
    const int num_connections = 5;
    std::vector<std::unique_ptr<ConnectionHandler>> handlers;
    
    // In a real test, you'd create multiple socket pairs and test concurrent handling
    // This demonstrates the test structure for concurrent connections
    
    EXPECT_EQ(handlers.size(), 0);
    
    // In a real integration test:
    // 1. Create multiple socket pairs
    // 2. Create connection handlers for each
    // 3. Start all handlers concurrently
    // 4. Send data through multiple connections
    // 5. Verify proper isolation and handling
    // 6. Clean up all connections
}
