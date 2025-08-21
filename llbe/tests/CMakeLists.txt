# Find GoogleTest
find_package(GTest REQUIRED)

# Include GoogleTest
include(GoogleTest)

# Test executable
add_executable(llbe_tests
    test_config.cpp
    test_dtls_server.cpp
    test_connection_handler.cpp
    test_logger.cpp
)

# Link libraries for tests
target_link_libraries(llbe_tests
    GTest::gtest_main
    ${DATACHANNEL_LIBRARIES}
    OpenSSL::SSL
    OpenSSL::Crypto
    Threads::Threads
    nlohmann_json::nlohmann_json
)

# Include directories for tests
target_include_directories(llbe_tests PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../include
    ${DATACHANNEL_INCLUDE_DIRS}
)

# Compiler definitions for tests
target_compile_definitions(llbe_tests PRIVATE ${DATACHANNEL_CFLAGS_OTHER})

# Link directories for tests
target_link_directories(llbe_tests PRIVATE ${DATACHANNEL_LIBRARY_DIRS})

# Add test sources to test executable (excluding main.cpp)
target_sources(llbe_tests PRIVATE
    ../src/config.cpp
    ../src/logger.cpp
    ../src/dtls_server.cpp
    ../src/connection_handler.cpp
)

# Discover tests for CTest
gtest_discover_tests(llbe_tests)
