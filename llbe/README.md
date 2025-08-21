# Telepresence Low Latency Backend (LLBE)

A high-performance C++ backend for telepresence robot communication using WebRTC data channels and DTLS.

## Features

- **DTLS Server**: Secure data transmission using DTLS (Datagram Transport Layer Security)
- **WebRTC Integration**: Uses libdatachannel for WebRTC peer connections
- **Multi-threaded**: One thread per connection for optimal performance
- **Low Latency**: Optimized for real-time communication
- **Configurable**: JSON-based configuration system
- **Comprehensive Testing**: Unit tests using Google Test framework

## Architecture

The backend consists of several key components:

- **DTLSServer**: Main server class handling DTLS connections
- **ConnectionHandler**: Manages individual client connections
- **Logger**: Thread-safe logging system
- **Config**: Configuration management

## Dependencies

- **libdatachannel**: WebRTC data channels implementation
- **OpenSSL**: DTLS/TLS cryptographic library
- **CMake**: Build system (version 3.16+)
- **Google Test**: Testing framework
- **C++17**: Minimum C++ standard

## Building

### Prerequisites

Install the required dependencies:

#### macOS (using Homebrew)
```bash
brew install cmake openssl pkg-config
brew install libdatachannel
```

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install cmake libssl-dev pkg-config
# For libdatachannel, you may need to build from source
```

### Build Instructions

1. Create build directory:
```bash
mkdir build && cd build
```

2. Configure with CMake:
```bash
cmake ..
```

3. Build the project:
```bash
make -j$(nproc)
```

4. Run tests:
```bash
make test
# or
ctest -V
```

## Usage

### Starting the Server

```bash
./telepresence_llbe
```

The server will start with default configuration. You can specify a custom config file:

```bash
./telepresence_llbe --config /path/to/config.json
```

### Configuration

The server uses a JSON configuration file (`config.json`) with the following structure:

```json
{
    "server": {
        "host": "0.0.0.0",
        "port": 8443,
        "max_connections": 100,
        "thread_pool_size": 4
    },
    "dtls": {
        "certificate_file": "cert.pem",
        "private_key_file": "key.pem",
        "verify_client": false
    },
    "logging": {
        "level": "info",
        "file": "llbe.log"
    }
}
```

### Generating SSL Certificates

For development, you can generate self-signed certificates:

```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## Project Structure

```
llbe/
├── CMakeLists.txt          # Main CMake configuration
├── README.md               # This file
├── config.json             # Default configuration
├── include/                # Header files
│   ├── dtls_server.hpp
│   ├── connection_handler.hpp
│   ├── logger.hpp
│   └── config.hpp
├── src/                    # Source files
│   ├── main.cpp
│   ├── dtls_server.cpp
│   ├── connection_handler.cpp
│   ├── logger.cpp
│   └── config.cpp
└── tests/                  # Test files
    ├── CMakeLists.txt
    ├── test_dtls_server.cpp
    ├── test_connection_handler.cpp
    └── test_config.cpp
```

## Development

### Code Style

- Follow modern C++17 practices
- Use RAII for resource management
- Prefer smart pointers over raw pointers
- Use const-correctness
- Follow Google C++ Style Guide

### Testing

Tests are located in the `tests/` directory and use Google Test framework. To add new tests:

1. Create a new test file in `tests/`
2. Add the test file to `tests/CMakeLists.txt`
3. Run tests with `make test`

### Debugging

For debug builds:

```bash
cmake -DCMAKE_BUILD_TYPE=Debug ..
make
```

## Performance Considerations

- Each client connection runs in its own thread
- Lock-free data structures are used where possible
- Memory allocation is minimized in hot paths
- Connection pooling for efficient resource usage

## Security

- DTLS 1.2+ encryption for all data transmission
- Certificate-based authentication
- Input validation and sanitization
- Protection against common attacks (DoS, replay, etc.)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is part of the telepresence robot system.

## Troubleshooting

### Common Issues

1. **libdatachannel not found**: Ensure libdatachannel is properly installed and in PKG_CONFIG_PATH
2. **OpenSSL errors**: Verify OpenSSL development headers are installed
3. **Port binding issues**: Check if port 8443 is available or change in config
4. **Certificate errors**: Ensure certificate and key files exist and are readable

For more help, check the logs or open an issue.
