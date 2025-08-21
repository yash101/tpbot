# Development Guide

## Quick Start

### 1. Setup Dependencies (macOS)
```bash
./setup_macos.sh
```

### 2. Build the Project
```bash
./build.sh
```

### 3. Run the Server
```bash
cd build
./telepresence_llbe
```

### 4. Test with Client
```bash
python3 test_client.py
```

## Manual Setup

### Dependencies
- **CMake** 3.16+
- **OpenSSL** development libraries
- **libdatachannel** 
- **nlohmann/json**
- **GoogleTest** (for testing)
- **pkg-config**

### macOS Installation
```bash
brew install cmake openssl pkg-config googletest nlohmann-json

# For libdatachannel (if not available in Homebrew)
git clone https://github.com/paullouisageneau/libdatachannel.git
cd libdatachannel
cmake -B build -DUSE_GNUTLS=0 -DUSE_NICE=0
cd build && make -j$(nproc) && sudo make install
```

### Ubuntu Installation
```bash
sudo apt-get update
sudo apt-get install cmake libssl-dev pkg-config libgtest-dev nlohmann-json3-dev

# Build libdatachannel from source
git clone https://github.com/paullouisageneau/libdatachannel.git
cd libdatachannel
cmake -B build -DUSE_GNUTLS=0 -DUSE_NICE=0
cd build && make -j$(nproc) && sudo make install
```

## Build Options

### Debug Build
```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)
```

### Release Build
```bash
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
```

### With Custom Paths
```bash
cmake .. -DCMAKE_PREFIX_PATH=/usr/local -DPKG_CONFIG_PATH=/usr/local/lib/pkgconfig
```

## Testing

### Run All Tests
```bash
cd build
make test
# or
ctest -V
```

### Run Specific Tests
```bash
cd build/tests
./llbe_tests --gtest_filter="ConfigTest.*"
```

### Memory Testing (with Valgrind)
```bash
valgrind --tool=memcheck --leak-check=full ./telepresence_llbe
```

## Docker Development

### Build Docker Image
```bash
docker build -t telepresence-llbe .
```

### Run with Docker Compose
```bash
docker-compose up
```

### Development Container
```bash
docker run -it --rm -v $(pwd):/app -w /app ubuntu:22.04 bash
# Then install dependencies and build inside container
```

## Configuration

### Environment Variables
- `LOG_LEVEL`: Override logging level (debug, info, warning, error, critical)
- `CONFIG_FILE`: Path to configuration file

### Configuration File Structure
See `config.json` for the complete configuration structure.

## SSL Certificates

### Generate Self-Signed Certificates for Development
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
    -subj "/C=US/ST=CA/L=San Francisco/O=Telepresence/CN=localhost"
```

### For Production
Use proper CA-signed certificates or Let's Encrypt:
```bash
# Using certbot for Let's Encrypt
sudo certbot certonly --standalone -d your-domain.com
```

## Debugging

### GDB Debugging
```bash
cd build
gdb ./telepresence_llbe
(gdb) run
```

### LLDB Debugging (macOS)
```bash
cd build
lldb ./telepresence_llbe
(lldb) run
```

### Log Analysis
```bash
tail -f llbe.log
# or with filtering
tail -f llbe.log | grep ERROR
```

## Performance Tuning

### Compiler Optimizations
```bash
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_FLAGS="-O3 -march=native"
```

### CPU Affinity (Linux)
```bash
taskset -c 0-3 ./telepresence_llbe  # Use cores 0-3
```

### Network Tuning
```bash
# Increase UDP buffer sizes
sudo sysctl -w net.core.rmem_max=26214400
sudo sysctl -w net.core.rmem_default=26214400
```

## Troubleshooting

### Common Issues

1. **libdatachannel not found**
   ```bash
   export PKG_CONFIG_PATH=/usr/local/lib/pkgconfig:$PKG_CONFIG_PATH
   ```

2. **OpenSSL version issues**
   ```bash
   brew link --force openssl  # macOS
   export OPENSSL_ROOT_DIR=/usr/local/opt/openssl  # if needed
   ```

3. **Port permission denied**
   ```bash
   # Use unprivileged port or run with sudo
   sudo ./telepresence_llbe
   # or change port in config.json to > 1024
   ```

4. **Certificate issues**
   ```bash
   # Check certificate validity
   openssl x509 -in cert.pem -text -noout
   # Verify key matches certificate
   openssl rsa -in key.pem -pubout | openssl sha256
   openssl x509 -in cert.pem -pubkey -noout | openssl sha256
   ```

### Debug Logging
Set log level to debug in config.json:
```json
{
  "logging": {
    "level": "debug"
  }
}
```

### Network Testing
```bash
# Test UDP connectivity
nc -u localhost 8443

# Check port binding
sudo netstat -ulnp | grep 8443
# or
sudo ss -ulnp | grep 8443
```

## Code Style

### Formatting
```bash
# Using clang-format (install if needed)
find . -name "*.cpp" -o -name "*.hpp" | xargs clang-format -i
```

### Static Analysis
```bash
# Using cppcheck
cppcheck --enable=all --std=c++17 src/ include/

# Using clang-static-analyzer
scan-build make
```

## Contributing

1. Follow the existing code style
2. Add tests for new functionality
3. Update documentation
4. Ensure all tests pass
5. Check for memory leaks with Valgrind

## Profiling

### CPU Profiling
```bash
# Using perf (Linux)
perf record ./telepresence_llbe
perf report

# Using Instruments (macOS)
instruments -t "Time Profiler" ./telepresence_llbe
```

### Memory Profiling
```bash
# Using Valgrind
valgrind --tool=massif ./telepresence_llbe

# Using AddressSanitizer
cmake .. -DCMAKE_CXX_FLAGS="-fsanitize=address -g"
make && ./telepresence_llbe
```
