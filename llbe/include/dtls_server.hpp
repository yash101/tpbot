#pragma once

#include <string>
#include <memory>
#include <thread>
#include <vector>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <queue>

#include <openssl/ssl.h>
#include <openssl/err.h>

class ConnectionHandler;
class Config;

/**
 * DTLS Server class for handling secure datagram connections
 * Supports multiple concurrent connections with one thread per connection
 */
class DTLSServer {
public:
    explicit DTLSServer(std::shared_ptr<Config> config);
    ~DTLSServer();

    // Non-copyable, non-movable
    DTLSServer(const DTLSServer&) = delete;
    DTLSServer& operator=(const DTLSServer&) = delete;
    DTLSServer(DTLSServer&&) = delete;
    DTLSServer& operator=(DTLSServer&&) = delete;

    /**
     * Initialize the server (SSL context, certificates, etc.)
     * @return true on success, false on failure
     */
    bool initialize();

    /**
     * Start the server and begin accepting connections
     * @return true on success, false on failure
     */
    bool start();

    /**
     * Stop the server and cleanup resources
     */
    void stop();

    /**
     * Check if server is currently running
     * @return true if running, false otherwise
     */
    bool isRunning() const { return running_.load(); }

    /**
     * Get the number of active connections
     * @return number of active connections
     */
    size_t getActiveConnections() const;

private:
    /**
     * Main server loop - accepts new connections
     */
    void serverLoop();

    /**
     * Handle a new client connection
     * @param client_fd socket file descriptor for the client
     */
    void handleNewConnection(int client_fd);

    /**
     * Cleanup finished connection threads
     */
    void cleanupConnections();

    /**
     * Initialize SSL context
     * @return true on success, false on failure
     */
    bool initializeSSLContext();

    /**
     * Load SSL certificates
     * @return true on success, false on failure
     */
    bool loadCertificates();

    std::shared_ptr<Config> config_;
    SSL_CTX* ssl_context_;
    int server_socket_;
    
    std::atomic<bool> running_;
    std::atomic<bool> should_stop_;
    
    std::thread server_thread_;
    std::vector<std::unique_ptr<ConnectionHandler>> connections_;
    std::mutex connections_mutex_;
    
    // Connection cleanup
    std::thread cleanup_thread_;
    std::condition_variable cleanup_cv_;
    std::mutex cleanup_mutex_;
    
    static constexpr int BACKLOG = 50;
    static constexpr int CLEANUP_INTERVAL_MS = 5000;
};
