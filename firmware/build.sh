#!/bin/bash

# ESP32-C5 Telepresence Robot Firmware Build Script

set -e  # Exit on any error

echo "ESP32-C5 Telepresence Robot Firmware Build Script"
echo "=================================================="

# Check if ESP-IDF is installed and sourced
if [ -z "$IDF_PATH" ]; then
    echo "ERROR: ESP-IDF not found. Please install ESP-IDF and source the export script:"
    echo "  . \$HOME/esp/esp-idf/export.sh"
    exit 1
fi

echo "ESP-IDF Path: $IDF_PATH"
echo "ESP-IDF Version: $(idf.py --version)"

# Set target to ESP32-C5
echo "Setting target to ESP32-C5..."
idf.py set-target esp32c5

# Clean previous builds
echo "Cleaning previous builds..."
idf.py clean

# Configure project
echo "Configuring project..."
idf.py reconfigure

# Build the project
echo "Building firmware..."
idf.py build

echo ""
echo "Build completed successfully!"
echo ""
echo "To flash and monitor:"
echo "  idf.py -p /dev/ttyUSB0 flash monitor"
echo ""
echo "To just flash:"
echo "  idf.py -p /dev/ttyUSB0 flash"
echo ""
echo "To monitor serial output:"
echo "  idf.py -p /dev/ttyUSB0 monitor"
echo ""
echo "Replace /dev/ttyUSB0 with your actual serial port"
echo "(On macOS, typically /dev/cu.usbserial-* or /dev/cu.SLAB_USBtoUART)"
