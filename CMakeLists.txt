cmake_minimum_required(VERSION 3.20)
project(telepresence-robot LANGUAGES NONE)
include(ExternalProject)

ExternalProject_Add(
    llbe
    SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/llbe
    BINARY_DIR ${CMAKE_CURRENT_BINARY_DIR}/llbe-build
    CMAKE_ARGS
        -DCMAKE_BUILD_TYPE=${CMAKE_BUILD_TYPE}
        -DCMAKE_CXX_STANDARD=20
        -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
        -DCMAKE_RUNTIME_OUTPUT_DIRECTORY:PATH=${CMAKE_BINARY_DIR}/bin
        -DCMAKE_LIBRARY_OUTPUT_DIRECTORY:PATH=${CMAKE_BINARY_DIR}/lib
        -DCMAKE_ARCHIVE_OUTPUT_DIRECTORY:PATH=${CMAKE_BINARY_DIR}/lib
    INSTALL_COMMAND ""    # <- disable install
)

# # Common options for all children

# ExternalProject_Add(
#     firmware
#     SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/firmware
#     BINARY_DIR ${CMAKE_CURRENT_BINARY_DIR}/firmware-build
#     CONFIGURE_COMMAND ${CMAKE_CURRENT_SOURCE_DIR}/firmware/build.sh
#     INSTALL_COMMAND ""    # <- disable install
# )
