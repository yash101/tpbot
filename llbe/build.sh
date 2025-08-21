#!/bin/bash

# Build script for Telepresence LLBE
# This script will build the project and run tests

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Telepresence LLBE Build Script ===${NC}"

# Check if we're in the right directory
if [ ! -f "CMakeLists.txt" ]; then
    echo -e "${RED}Error: CMakeLists.txt not found. Run this script from the llbe directory.${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
echo -e "${YELLOW}Checking dependencies...${NC}"

if ! command_exists cmake; then
    echo -e "${RED}Error: cmake not found. Please install cmake.${NC}"
    exit 1
fi

if ! command_exists pkg-config; then
    echo -e "${RED}Error: pkg-config not found. Please install pkg-config.${NC}"
    exit 1
fi

# Check for OpenSSL
if ! pkg-config --exists openssl; then
    echo -e "${RED}Error: OpenSSL not found. Please install OpenSSL development libraries.${NC}"
    exit 1
fi

# Check for libdatachannel (this might fail if not installed)
if ! pkg-config --exists libdatachannel; then
    echo -e "${YELLOW}Warning: libdatachannel not found via pkg-config.${NC}"
    echo -e "${YELLOW}You may need to install libdatachannel or adjust PKG_CONFIG_PATH.${NC}"
fi

echo -e "${GREEN}Dependencies check complete.${NC}"

# Create build directory
BUILD_DIR="build"
if [ -d "$BUILD_DIR" ]; then
    echo -e "${YELLOW}Cleaning existing build directory...${NC}"
    rm -rf "$BUILD_DIR"
fi

mkdir "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
echo -e "${YELLOW}Configuring with CMake...${NC}"
cmake .. -DCMAKE_BUILD_TYPE=Release

# Build
echo -e "${YELLOW}Building project...${NC}"
make -j$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)

echo -e "${GREEN}Build completed successfully!${NC}"

# Run tests if they were built
if [ -f "tests/llbe_tests" ]; then
    echo -e "${YELLOW}Running tests...${NC}"
    cd tests
    ./llbe_tests
    cd ..
    echo -e "${GREEN}All tests passed!${NC}"
else
    echo -e "${YELLOW}Tests not built (GoogleTest might not be available).${NC}"
fi

echo -e "${GREEN}=== Build Complete ===${NC}"
echo -e "Executable: ${BUILD_DIR}/telepresence_llbe"
echo -e "To run: cd ${BUILD_DIR} && ./telepresence_llbe"
