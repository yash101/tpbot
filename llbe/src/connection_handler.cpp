#include "connection_handler.hpp"
#include "config.hpp"
#include "logger.hpp"

#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <cstring>
#include <cerrno>

ConnectionHandler::ConnectionHandler(int socket_fd, SSL_CTX* ssl_context, std::shared_ptr<Config> config)
    : socket_fd_(socket_fd)
    , ssl_context_(ssl_context)
    , ssl_(nullptr)
    , config_(config)
    , active_(false)
    , finished_(false)
    , should_stop_(false)
    , start_time_(std::chrono::steady_clock::now())
    , bytes_received_(0)
    , bytes_sent_(0) {
    
    // Get client address
    struct sockaddr_in client_addr;
    socklen_t addr_len = sizeof(client_addr);
    if (getpeername(socket_fd_, (struct sockaddr*)&client_addr, &addr_len) == 0) {
        char addr_str[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &client_addr.sin_addr, addr_str, INET_ADDRSTRLEN);
        client_address_ = std::string(addr_str) + ":" + std::to_string(ntohs(client_addr.sin_port));
    } else {
        client_address_ = "unknown";
    }
}

ConnectionHandler::~ConnectionHandler() {
    stop();
}

void ConnectionHandler::start() {
    if (active_.load()) {
        return;
    }
    
    LOG_DEBUG("Starting connection handler for " + client_address_);
    
    should_stop_.store(false);
    connection_thread_ = std::thread(&ConnectionHandler::connectionLoop, this);
}

void ConnectionHandler::stop() {
    if (!active_.load() && finished_.load()) {
        return;
    }
    
    LOG_DEBUG("Stopping connection handler for " + client_address_);
    
    should_stop_.store(true);
    
    if (connection_thread_.joinable()) {
        connection_thread_.join();
    }
    
    cleanup();
}

bool ConnectionHandler::sendData(const std::string& data) {
    return sendData(data.data(), data.size());
}

bool ConnectionHandler::sendData(const void* data, size_t length) {
    if (!ssl_ || !active_.load()) {
        return false;
    }
    
    int sent = SSL_write(ssl_, data, static_cast<int>(length));
    if (sent > 0) {
        bytes_sent_.fetch_add(sent);
        return true;
    } else {
        int error = SSL_get_error(ssl_, sent);
        if (error != SSL_ERROR_WANT_WRITE && error != SSL_ERROR_WANT_READ) {
            LOG_ERROR("SSL_write failed: " + std::to_string(error));
            return false;
        }
        // Would block, try again later
        return true;
    }
}

void ConnectionHandler::connectionLoop() {
    LOG_INFO("Connection loop started for " + client_address_);
    
    try {
        // Initialize DTLS connection
        if (!initializeDTLS()) {
            LOG_ERROR("Failed to initialize DTLS for " + client_address_);
            finished_.store(true);
            return;
        }
        
        active_.store(true);
        LOG_INFO("DTLS handshake completed for " + client_address_);
        
        char buffer[BUFFER_SIZE];
        
        while (!should_stop_.load() && active_.load()) {
            // Set up select for timeout
            fd_set read_fds;
            FD_ZERO(&read_fds);
            FD_SET(socket_fd_, &read_fds);
            
            struct timeval timeout;
            timeout.tv_sec = 1;
            timeout.tv_usec = 0;
            
            int result = select(socket_fd_ + 1, &read_fds, nullptr, nullptr, &timeout);
            
            if (result < 0) {
                if (errno != EINTR) {
                    LOG_ERROR("Select error for " + client_address_ + ": " + std::string(strerror(errno)));
                    break;
                }
                continue;
            } else if (result == 0) {
                // Timeout, continue loop
                continue;
            }
            
            if (FD_ISSET(socket_fd_, &read_fds)) {
                int received = SSL_read(ssl_, buffer, BUFFER_SIZE);
                
                if (received > 0) {
                    bytes_received_.fetch_add(received);
                    handleReceivedData(buffer, received);
                } else {
                    int error = SSL_get_error(ssl_, received);
                    
                    if (error == SSL_ERROR_WANT_READ || error == SSL_ERROR_WANT_WRITE) {
                        // Would block, continue
                        continue;
                    } else if (error == SSL_ERROR_ZERO_RETURN) {
                        // Clean shutdown
                        LOG_INFO("Client " + client_address_ + " closed connection");
                        break;
                    } else {
                        // Error occurred
                        LOG_ERROR("SSL_read error for " + client_address_ + ": " + std::to_string(error));
                        break;
                    }
                }
            }
        }
        
    } catch (const std::exception& e) {
        LOG_ERROR("Exception in connection loop for " + client_address_ + ": " + std::string(e.what()));
    }
    
    active_.store(false);
    finished_.store(true);
    
    if (disconnect_callback_) {
        disconnect_callback_();
    }
    
    LOG_INFO("Connection loop ended for " + client_address_);
}

bool ConnectionHandler::initializeDTLS() {
    // Create SSL object
    ssl_ = SSL_new(ssl_context_);
    if (!ssl_) {
        LOG_ERROR("Failed to create SSL object");
        return false;
    }
    
    // Set socket
    if (SSL_set_fd(ssl_, socket_fd_) != 1) {
        LOG_ERROR("Failed to set SSL file descriptor");
        return false;
    }
    
    // Set connect state (we're the server)
    SSL_set_accept_state(ssl_);
    
    // Set non-blocking mode
    if (!setNonBlocking(socket_fd_)) {
        LOG_WARNING("Failed to set socket to non-blocking mode");
    }
    
    // Perform DTLS handshake with timeout
    auto start_time = std::chrono::steady_clock::now();
    auto timeout = std::chrono::milliseconds(config_->dtls.handshake_timeout_ms);
    
    while (std::chrono::steady_clock::now() - start_time < timeout) {
        int result = SSL_accept(ssl_);
        
        if (result == 1) {
            // Handshake completed successfully
            LOG_DEBUG("DTLS handshake completed for " + client_address_);
            return true;
        }
        
        int error = SSL_get_error(ssl_, result);
        
        if (error == SSL_ERROR_WANT_READ || error == SSL_ERROR_WANT_WRITE) {
            // Need to wait for more data or socket to be ready
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        } else {
            // Fatal error
            char err_buf[256];
            ERR_error_string_n(ERR_get_error(), err_buf, sizeof(err_buf));
            LOG_ERROR("DTLS handshake failed for " + client_address_ + ": " + std::string(err_buf));
            return false;
        }
    }
    
    LOG_ERROR("DTLS handshake timeout for " + client_address_);
    return false;
}

void ConnectionHandler::handleReceivedData(const void* data, size_t length) {
    if (message_callback_) {
        std::string message(static_cast<const char*>(data), length);
        message_callback_(message);
    }
    
    // Echo the data back for testing
    sendData(data, length);
}

void ConnectionHandler::cleanup() {
    if (ssl_) {
        SSL_shutdown(ssl_);
        SSL_free(ssl_);
        ssl_ = nullptr;
    }
    
    if (socket_fd_ != -1) {
        close(socket_fd_);
        socket_fd_ = -1;
    }
}

bool ConnectionHandler::setNonBlocking(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    if (flags == -1) {
        return false;
    }
    
    return fcntl(fd, F_SETFL, flags | O_NONBLOCK) != -1;
}
