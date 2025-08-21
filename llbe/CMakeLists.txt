cmake_minimum_required(VERSION 3.16)
project(telepresence_llbe VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -DNDEBUG")
endif()

# Find packages
find_package(PkgConfig REQUIRED)
find_package(Threads REQUIRED)
find_package(GTest REQUIRED)

# Find libdatachannel
pkg_check_modules(DATACHANNEL REQUIRED libdatachannel)

# Find OpenSSL for DTLS
find_package(OpenSSL REQUIRED)

# Find nlohmann/json
find_package(nlohmann_json REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)
include_directories(${DATACHANNEL_INCLUDE_DIRS})

# Source files
set(SOURCES
    src/main.cpp
    src/dtls_server.cpp
    src/connection_handler.cpp
    src/logger.cpp
    src/config.cpp
)

# Create executable
add_executable(${PROJECT_NAME} ${SOURCES})

# Link libraries
target_link_libraries(${PROJECT_NAME}
    ${DATACHANNEL_LIBRARIES}
    OpenSSL::SSL
    OpenSSL::Crypto
    Threads::Threads
    nlohmann_json::nlohmann_json
)

# Compiler definitions
target_compile_definitions(${PROJECT_NAME} PRIVATE ${DATACHANNEL_CFLAGS_OTHER})

# Link directories
target_link_directories(${PROJECT_NAME} PRIVATE ${DATACHANNEL_LIBRARY_DIRS})

# Enable testing
enable_testing()

# Add subdirectories
add_subdirectory(tests)

# Installation
install(TARGETS ${PROJECT_NAME}
    RUNTIME DESTINATION bin
)

# Generate compile commands for IDEs
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
