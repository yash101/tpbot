#pragma once

#include <string>
#include <memory>
#include <thread>
#include <atomic>
#include <functional>
#include <chrono>

#include <openssl/ssl.h>
#include <rtc/rtc.hpp>

class Config;

/**
 * Handles individual client connections
 * Each connection runs in its own thread for maximum concurrency
 */
class ConnectionHandler {
public:
    using MessageCallback = std::function<void(const std::string&)>;
    using DisconnectCallback = std::function<void()>;

    ConnectionHandler(int socket_fd, SSL_CTX* ssl_context, std::shared_ptr<Config> config);
    ~ConnectionHandler();

    // Non-copyable, non-movable
    ConnectionHandler(const ConnectionHandler&) = delete;
    ConnectionHandler& operator=(const ConnectionHandler&) = delete;
    ConnectionHandler(ConnectionHandler&&) = delete;
    ConnectionHandler& operator=(ConnectionHandler&&) = delete;

    /**
     * Start handling the connection
     * This will spawn a new thread to handle the connection
     */
    void start();

    /**
     * Stop handling the connection and cleanup
     */
    void stop();

    /**
     * Check if the connection is still active
     * @return true if active, false otherwise
     */
    bool isActive() const { return active_.load(); }

    /**
     * Check if the connection thread has finished
     * @return true if finished, false otherwise
     */
    bool isFinished() const { return finished_.load(); }

    /**
     * Send data to the client
     * @param data data to send
     * @return true on success, false on failure
     */
    bool sendData(const std::string& data);

    /**
     * Send data to the client
     * @param data pointer to data buffer
     * @param length length of data
     * @return true on success, false on failure
     */
    bool sendData(const void* data, size_t length);

    /**
     * Set callback for received messages
     * @param callback function to call when message is received
     */
    void setMessageCallback(MessageCallback callback) { message_callback_ = callback; }

    /**
     * Set callback for disconnection
     * @param callback function to call when client disconnects
     */
    void setDisconnectCallback(DisconnectCallback callback) { disconnect_callback_ = callback; }

    /**
     * Get client address as string
     * @return client address string
     */
    const std::string& getClientAddress() const { return client_address_; }

    /**
     * Get connection start time
     * @return connection start time
     */
    std::chrono::steady_clock::time_point getStartTime() const { return start_time_; }

    /**
     * Get bytes received count
     * @return total bytes received
     */
    uint64_t getBytesReceived() const { return bytes_received_.load(); }

    /**
     * Get bytes sent count
     * @return total bytes sent
     */
    uint64_t getBytesSent() const { return bytes_sent_.load(); }

private:
    /**
     * Main connection handling loop
     */
    void connectionLoop();

    /**
     * Initialize DTLS connection
     * @return true on success, false on failure
     */
    bool initializeDTLS();

    /**
     * Handle received data
     * @param data received data
     * @param length data length
     */
    void handleReceivedData(const void* data, size_t length);

    /**
     * Cleanup connection resources
     */
    void cleanup();

    /**
     * Set socket to non-blocking mode
     * @param fd socket file descriptor
     * @return true on success, false on failure
     */
    bool setNonBlocking(int fd);

    int socket_fd_;
    SSL_CTX* ssl_context_;
    SSL* ssl_;
    std::shared_ptr<Config> config_;
    
    std::atomic<bool> active_;
    std::atomic<bool> finished_;
    std::atomic<bool> should_stop_;
    
    std::thread connection_thread_;
    
    std::string client_address_;
    std::chrono::steady_clock::time_point start_time_;
    
    std::atomic<uint64_t> bytes_received_;
    std::atomic<uint64_t> bytes_sent_;
    
    MessageCallback message_callback_;
    DisconnectCallback disconnect_callback_;
    
    static constexpr int BUFFER_SIZE = 8192;
    static constexpr int DTLS_TIMEOUT_MS = 30000; // 30 seconds
};
