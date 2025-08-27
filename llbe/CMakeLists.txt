cmake_minimum_required(VERSION 3.16)
project(telepresence_llbe VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)

# Compiler flags
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -Wall -Wextra -Wpedantic")
    set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -g -O0")
    set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -O3 -DNDEBUG")
endif()

# Find packages
find_package(PkgConfig REQUIRED)
find_package(Threads REQUIRED)

# nlohmann_json
set(JSON_Install OFF CACHE INTERNAL "")
set(JSON_BuildTests OFF CACHE INTERNAL "")
set(JSON_BuildExamples OFF CACHE INTERNAL "")
set(JSON_BuildDoc OFF CACHE INTERNAL "")
add_subdirectory(vendor/json)

# GoogleTest
add_subdirectory(
    "vendor/googletest"
    "vendor/googletest"
)
include(GoogleTest)

# libdatachannel
set(USE_SYSTEM_JSON "Use system-installed nlohmann/json" ON CACHE BOOL "" FORCE)
set(NO_EXAMPLES "Do not build examples" ON CACHE BOOL "" FORCE)
add_subdirectory(
    "vendor/libdatachannel"
    "vendor/libdatachannel"
)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)
include_directories(${DATACHANNEL_INCLUDE_DIRS})

# Enable testing
enable_testing()

add_subdirectory(src)

target_compile_definitions(libllbe PRIVATE ${DATACHANNEL_CFLAGS_OTHER})
target_link_directories(libllbe PRIVATE ${DATACHANNEL_LIBRARY_DIRS})
target_link_libraries(
    libllbe
    ${DATACHANNEL_LIBRARIES}
    Threads::Threads
    nlohmann_json::nlohmann_json
)

target_compile_definitions(${PROJECT_NAME} PRIVATE ${DATACHANNEL_CFLAGS_OTHER})
target_link_directories(${PROJECT_NAME} PRIVATE ${DATACHANNEL_LIBRARY_DIRS})
target_link_libraries(
    ${PROJECT_NAME}
    libllbe
    ${DATACHANNEL_LIBRARIES}
    Threads::Threads
    nlohmann_json::nlohmann_json
)

# # Installation
# install(TARGETS libllbe
#     RUNTIME DESTINATION bin
# )

# Generate compile commands for IDEs
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
