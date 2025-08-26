# GoogleTest is vendored by the parent CMake via FetchContent in ../CMakeLists.txt
# (FetchContent_MakeAvailable(googletest) provides the GTest::gtest_main target)

# Include GoogleTest
include(GoogleTest)

# Test executable: include test sources plus the libllbe object files
add_executable(llbe_tests
    test_config.cpp
#    test_dtls_server.cpp
    test_connection_handler.cpp
    test_logger.cpp
    $<TARGET_OBJECTS:libllbe>
)

# Link libraries for tests
# Note: object files from libllbe are compiled into this executable, so we still need to
# link the external libraries they depend on.
target_link_libraries(llbe_tests
    GTest::gtest_main
    ${DATACHANNEL_LIBRARIES}
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

# Discover tests for CTest
gtest_discover_tests(llbe_tests)
