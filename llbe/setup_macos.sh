#!/bin/bash

# Setup script for Telepresence LLBE dependencies on macOS
# This script will install required dependencies using Homebrew

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Telepresence LLBE Setup Script for macOS ===${NC}"

# Check if Homebrew is installed
if ! command -v brew >/dev/null 2>&1; then
    echo -e "${RED}Error: Homebrew not found.${NC}"
    echo -e "${YELLOW}Please install Homebrew first: https://brew.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}Updating Homebrew...${NC}"
brew update

echo -e "${YELLOW}Installing CMake...${NC}"
brew install cmake

echo -e "${YELLOW}Installing OpenSSL...${NC}"
brew install openssl

echo -e "${YELLOW}Installing pkg-config...${NC}"
brew install pkg-config

echo -e "${YELLOW}Installing GoogleTest...${NC}"
brew install googletest

echo -e "${YELLOW}Installing nlohmann-json...${NC}"
brew install nlohmann-json

echo -e "${YELLOW}Installing libdatachannel...${NC}"
# libdatachannel might not be available in Homebrew, so we'll try to install it
if brew list libdatachannel >/dev/null 2>&1; then
    echo -e "${GREEN}libdatachannel already installed.${NC}"
elif brew install libdatachannel 2>/dev/null; then
    echo -e "${GREEN}libdatachannel installed successfully.${NC}"
else
    echo -e "${YELLOW}libdatachannel not available in Homebrew.${NC}"
    echo -e "${YELLOW}You may need to build it from source:${NC}"
    echo -e "  git clone https://github.com/paullouisageneau/libdatachannel.git"
    echo -e "  cd libdatachannel"
    echo -e "  cmake -B build -DUSE_GNUTLS=0 -DUSE_NICE=0"
    echo -e "  cd build && make -j$(nproc) && sudo make install"
fi

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo -e "You can now build the project by running:"
echo -e "  ./build.sh"

# Create test certificates for development
echo -e "${YELLOW}Creating test certificates for development...${NC}"
if [ ! -f "cert.pem" ] || [ ! -f "key.pem" ]; then
    openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
        -subj "/C=US/ST=CA/L=San Francisco/O=Telepresence/CN=localhost"
    echo -e "${GREEN}Test certificates created: cert.pem and key.pem${NC}"
else
    echo -e "${GREEN}Test certificates already exist.${NC}"
fi

echo -e "${GREEN}Setup completed successfully!${NC}"
