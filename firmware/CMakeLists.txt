# CMakeLists.txt for ESP32-C5 Telepresence Robot Firmware

cmake_minimum_required(VERSION 3.16)

# Set target and board
set(ESP_PLATFORM 1)
set(IDF_TARGET esp32c5)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)

project(telepresence_robot_firmware)
