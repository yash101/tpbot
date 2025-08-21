#include "dtls_server.hpp"
#include "connection_handler.hpp"
#include "config.hpp"
#include "logger.hpp"

#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <algorithm>
#include <cstring>
#include <cerrno>

DTLSServer::DTLSServer(std::shared_ptr<Config> config)
    : config_(config)
    , ssl_context_(nullptr)
    , server_socket_(-1)
    , running_(false)
    , should_stop_(false) {
}

DTLSServer::~DTLSServer() {
    stop();
    
    if (ssl_context_) {
        SSL_CTX_free(ssl_context_);
    }
    
    if (server_socket_ != -1) {
        close(server_socket_);
    }
}

bool DTLSServer::initialize() {
    LOG_INFO("Initializing DTLS server...");
    
    // Initialize OpenSSL
    SSL_library_init();
    SSL_load_error_strings();
    OpenSSL_add_all_algorithms();
    
    // Initialize SSL context
    if (!initializeSSLContext()) {
        LOG_ERROR("Failed to initialize SSL context");
        return false;
    }
    
    // Load certificates
    if (!loadCertificates()) {
        LOG_ERROR("Failed to load certificates");
        return false;
    }
    
    // Create server socket
    server_socket_ = socket(AF_INET, SOCK_DGRAM, 0);
    if (server_socket_ < 0) {
        LOG_ERROR("Failed to create server socket: " + std::string(strerror(errno)));
        return false;
    }
    
    // Set socket options
    int opt = 1;
    if (setsockopt(server_socket_, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt)) < 0) {
        LOG_WARNING("Failed to set SO_REUSEADDR: " + std::string(strerror(errno)));
    }
    
    // Bind socket
    struct sockaddr_in server_addr;
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(config_->server.port);
    
    if (config_->server.host == "0.0.0.0") {
        server_addr.sin_addr.s_addr = INADDR_ANY;
    } else {
        if (inet_pton(AF_INET, config_->server.host.c_str(), &server_addr.sin_addr) <= 0) {
            LOG_ERROR("Invalid server host address: " + config_->server.host);
            return false;
        }
    }
    
    if (bind(server_socket_, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) {
        LOG_ERROR("Failed to bind server socket: " + std::string(strerror(errno)));
        return false;
    }
    
    LOG_INFO("DTLS server initialized successfully");
    return true;
}

bool DTLSServer::start() {
    if (running_.load()) {
        LOG_WARNING("Server is already running");
        return true;
    }
    
    LOG_INFO("Starting DTLS server...");
    
    should_stop_.store(false);
    running_.store(true);
    
    // Start server thread
    server_thread_ = std::thread(&DTLSServer::serverLoop, this);
    
    // Start cleanup thread
    cleanup_thread_ = std::thread([this]() {
        while (!should_stop_.load()) {
            std::unique_lock<std::mutex> lock(cleanup_mutex_);
            cleanup_cv_.wait_for(lock, std::chrono::milliseconds(CLEANUP_INTERVAL_MS));
            
            if (!should_stop_.load()) {
                cleanupConnections();
            }
        }
    });
    
    LOG_INFO("DTLS server started successfully");
    return true;
}

void DTLSServer::stop() {
    if (!running_.load()) {
        return;
    }
    
    LOG_INFO("Stopping DTLS server...");
    
    should_stop_.store(true);
    running_.store(false);
    
    // Close server socket to interrupt accept loop
    if (server_socket_ != -1) {
        shutdown(server_socket_, SHUT_RDWR);
    }
    
    // Wait for server thread to finish
    if (server_thread_.joinable()) {
        server_thread_.join();
    }
    
    // Notify cleanup thread and wait
    cleanup_cv_.notify_all();
    if (cleanup_thread_.joinable()) {
        cleanup_thread_.join();
    }
    
    // Stop all connections
    {
        std::lock_guard<std::mutex> lock(connections_mutex_);
        for (auto& connection : connections_) {
            connection->stop();
        }
        connections_.clear();
    }
    
    LOG_INFO("DTLS server stopped");
}

size_t DTLSServer::getActiveConnections() const {
    std::lock_guard<std::mutex> lock(connections_mutex_);
    return std::count_if(connections_.begin(), connections_.end(),
        [](const auto& conn) { return conn->isActive(); });
}

void DTLSServer::serverLoop() {
    LOG_INFO("Server loop started");
    
    char buffer[1024];
    struct sockaddr_in client_addr;
    socklen_t client_len = sizeof(client_addr);
    
    while (!should_stop_.load()) {
        // Set socket timeout for non-blocking behavior
        struct timeval timeout;
        timeout.tv_sec = 1;
        timeout.tv_usec = 0;
        
        fd_set read_fds;
        FD_ZERO(&read_fds);
        FD_SET(server_socket_, &read_fds);
        
        int result = select(server_socket_ + 1, &read_fds, nullptr, nullptr, &timeout);
        
        if (result < 0) {
            if (errno != EINTR) {
                LOG_ERROR("Select error: " + std::string(strerror(errno)));
            }
            break;
        } else if (result == 0) {
            // Timeout, continue loop
            continue;
        }
        
        if (FD_ISSET(server_socket_, &read_fds)) {
            // Receive initial packet to detect new connection
            ssize_t received = recvfrom(server_socket_, buffer, sizeof(buffer), MSG_PEEK,
                                      (struct sockaddr*)&client_addr, &client_len);
            
            if (received > 0) {
                // Check connection limit
                if (getActiveConnections() >= static_cast<size_t>(config_->server.max_connections)) {
                    LOG_WARNING("Maximum connections reached, rejecting new connection");
                    // Read and discard the packet
                    recvfrom(server_socket_, buffer, sizeof(buffer), 0,
                           (struct sockaddr*)&client_addr, &client_len);
                    continue;
                }
                
                // Create new socket for this client
                int client_socket = socket(AF_INET, SOCK_DGRAM, 0);
                if (client_socket < 0) {
                    LOG_ERROR("Failed to create client socket: " + std::string(strerror(errno)));
                    continue;
                }
                
                // Connect to client
                if (connect(client_socket, (struct sockaddr*)&client_addr, client_len) < 0) {
                    LOG_ERROR("Failed to connect to client: " + std::string(strerror(errno)));
                    close(client_socket);
                    continue;
                }
                
                // Read the actual packet from the server socket
                recvfrom(server_socket_, buffer, sizeof(buffer), 0,
                       (struct sockaddr*)&client_addr, &client_len);
                
                // Send the packet to the client socket
                send(client_socket, buffer, received, 0);
                
                handleNewConnection(client_socket);
            }
        }
    }
    
    LOG_INFO("Server loop ended");
}

void DTLSServer::handleNewConnection(int client_fd) {
    try {
        // Create connection handler
        auto connection = std::make_unique<ConnectionHandler>(client_fd, ssl_context_, config_);
        
        // Set callbacks
        connection->setMessageCallback([this](const std::string& message) {
            // Handle received message
            LOG_DEBUG("Received message: " + message);
        });
        
        connection->setDisconnectCallback([this]() {
            // Handle client disconnect
            LOG_INFO("Client disconnected");
        });
        
        LOG_INFO("New connection from " + connection->getClientAddress());
        
        // Start connection
        connection->start();
        
        // Add to connections list
        {
            std::lock_guard<std::mutex> lock(connections_mutex_);
            connections_.push_back(std::move(connection));
        }
        
    } catch (const std::exception& e) {
        LOG_ERROR("Failed to handle new connection: " + std::string(e.what()));
        close(client_fd);
    }
}

void DTLSServer::cleanupConnections() {
    std::lock_guard<std::mutex> lock(connections_mutex_);
    
    auto it = std::remove_if(connections_.begin(), connections_.end(),
        [](const auto& conn) { return conn->isFinished(); });
    
    if (it != connections_.end()) {
        size_t removed = std::distance(it, connections_.end());
        connections_.erase(it, connections_.end());
        LOG_DEBUG("Cleaned up " + std::to_string(removed) + " finished connections");
    }
}

bool DTLSServer::initializeSSLContext() {
    const SSL_METHOD* method = DTLS_server_method();
    ssl_context_ = SSL_CTX_new(method);
    
    if (!ssl_context_) {
        LOG_ERROR("Failed to create SSL context");
        return false;
    }
    
    // Set DTLS options
    SSL_CTX_set_mode(ssl_context_, SSL_MODE_AUTO_RETRY);
    SSL_CTX_set_options(ssl_context_, SSL_OP_NO_QUERY_MTU);
    SSL_CTX_set_options(ssl_context_, SSL_OP_COOKIE_EXCHANGE);
    
    // Set cipher list
    if (SSL_CTX_set_cipher_list(ssl_context_, config_->dtls.cipher_list.c_str()) != 1) {
        LOG_WARNING("Failed to set cipher list, using defaults");
    }
    
    // Set verification mode
    int verify_mode = SSL_VERIFY_NONE;
    if (config_->dtls.verify_client) {
        verify_mode = SSL_VERIFY_PEER | SSL_VERIFY_FAIL_IF_NO_PEER_CERT;
    }
    SSL_CTX_set_verify(ssl_context_, verify_mode, nullptr);
    
    return true;
}

bool DTLSServer::loadCertificates() {
    // Load certificate
    if (SSL_CTX_use_certificate_file(ssl_context_, config_->dtls.certificate_file.c_str(), SSL_FILETYPE_PEM) != 1) {
        LOG_ERROR("Failed to load certificate file: " + config_->dtls.certificate_file);
        return false;
    }
    
    // Load private key
    if (SSL_CTX_use_PrivateKey_file(ssl_context_, config_->dtls.private_key_file.c_str(), SSL_FILETYPE_PEM) != 1) {
        LOG_ERROR("Failed to load private key file: " + config_->dtls.private_key_file);
        return false;
    }
    
    // Verify private key matches certificate
    if (SSL_CTX_check_private_key(ssl_context_) != 1) {
        LOG_ERROR("Private key does not match certificate");
        return false;
    }
    
    LOG_INFO("Certificates loaded successfully");
    return true;
}
