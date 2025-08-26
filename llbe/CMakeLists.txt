cmake_minimum_required(VERSION 3.16)
project(telepresence_llbe VERSION 1.0.0 LANGUAGES CXX)

# Set C++ standard
set(CMAKE_CXX_STANDARD 20)
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







# # Determine monorepo vendor directory (parent directory of this subproject)
# get_filename_component(LLBE_PARENT_DIR ${CMAKE_CURRENT_SOURCE_DIR} DIRECTORY)
# set(MONOREPO_VENDOR_DIR "${LLBE_PARENT_DIR}/vendor")
# if(EXISTS "${MONOREPO_VENDOR_DIR}")
#     file(REAL_PATH "${MONOREPO_VENDOR_DIR}" MONOREPO_VENDOR_DIR_REAL)
# else()
#     # fall back to the non-canonical path so subsequent EXISTS checks still work
#     set(MONOREPO_VENDOR_DIR_REAL "${MONOREPO_VENDOR_DIR}")
# endif()

# # If the monorepo vendors nlohmann/json (single_include), prefer that and provide
# # the standard CMake target name so downstream projects (and libdatachannel)
# # will pick it up instead of configuring their own copy. However, if another
# # subproject (e.g. vendored libdatachannel) ships its own copy of nlohmann_json
# # (under libdatachannel/deps/json) we must not pre-create the namespaced alias
# # target because that will conflict when the other copy sets up its targets.
# if(EXISTS "${MONOREPO_VENDOR_DIR_REAL}/json/CMakeLists.txt")
#     message(STATUS "Using vendored nlohmann_json project from ${MONOREPO_VENDOR_DIR_REAL}/json")
#     add_subdirectory("${MONOREPO_VENDOR_DIR_REAL}/json" "${CMAKE_BINARY_DIR}/vendor/json-build")
# elseif(EXISTS "${MONOREPO_VENDOR_DIR_REAL}/json/single_include/nlohmann")
#     # Only create an imported alias target when there is no other vendored copy that
#     # will later try to create the same namespaced target. If libdatachannel provides
#     # its own copy under its deps, skip creating this imported target to avoid alias conflicts.
#     if(NOT EXISTS "${MONOREPO_VENDOR_DIR_REAL}/libdatachannel/deps/json/CMakeLists.txt")
#         message(STATUS "Using vendored nlohmann_json single-header from ${MONOREPO_VENDOR_DIR_REAL}/json/single_include")
#         if(NOT TARGET nlohmann_json::nlohmann_json)
#             add_library(nlohmann_json::nlohmann_json INTERFACE IMPORTED)
#             set_target_properties(nlohmann_json::nlohmann_json PROPERTIES
#                 INTERFACE_INCLUDE_DIRECTORIES "${MONOREPO_VENDOR_DIR_REAL}/json/single_include"
#             )
#         endif()
#     else()
#         message(STATUS "Monorepo provides single-header nlohmann/json but libdatachannel also bundles JSON; skipping pre-create of nlohmann_json::nlohmann_json to avoid target conflicts")
#     endif()
# endif()

# # Vendor googletest so tests build reproducibly without a system package
# # Prefer a vendored copy under the monorepo vendor directory when available
# if(EXISTS "${MONOREPO_VENDOR_DIR_REAL}/googletest/CMakeLists.txt")
#     message(STATUS "Using vendored googletest from ${MONOREPO_VENDOR_DIR_REAL}/googletest")
#     add_subdirectory("${MONOREPO_VENDOR_DIR_REAL}/googletest" "${CMAKE_BINARY_DIR}/vendor/googletest-build")
# else()
#     include(FetchContent)
#     FetchContent_Declare(
#       googletest
#       GIT_REPOSITORY https://github.com/google/googletest.git
#       GIT_TAG v1.17.0
#     )
#     # Option to force shared CRT on Windows (harmless elsewhere)
#     set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
#     FetchContent_MakeAvailable(googletest)
# endif()

# # Find libdatachannel (prefer vendored copy under the monorepo vendor directory)
# if(EXISTS "${MONOREPO_VENDOR_DIR_REAL}/libdatachannel/CMakeLists.txt")
#     message(STATUS "Using vendored libdatachannel from ${MONOREPO_VENDOR_DIR_REAL}/libdatachannel")
#     add_subdirectory("${MONOREPO_VENDOR_DIR_REAL}/libdatachannel" "${CMAKE_BINARY_DIR}/vendor/libdatachannel-build")

#     # Try to populate the pkg-config style variables used elsewhere in this project
#     if(TARGET datachannel)
#         set(DATACHANNEL_LIBRARIES datachannel)
#         get_target_property(DATACHANNEL_INCLUDE_DIRS datachannel INTERFACE_INCLUDE_DIRECTORIES)
#         set(DATACHANNEL_LIBRARY_DIRS "")
#         set(DATACHANNEL_CFLAGS_OTHER "")
#     elseif(TARGET libdatachannel)
#         set(DATACHANNEL_LIBRARIES libdatachannel)
#         get_target_property(DATACHANNEL_INCLUDE_DIRS libdatachannel INTERFACE_INCLUDE_DIRECTORIES)
#         set(DATACHANNEL_LIBRARY_DIRS "")
#         set(DATACHANNEL_CFLAGS_OTHER "")
#     else()
#         message(WARNING "Vendored libdatachannel added but no known target found; falling back to pkg-config lookup")
#         pkg_check_modules(DATACHANNEL REQUIRED libdatachannel)
#     endif()
# else()
#     pkg_check_modules(DATACHANNEL REQUIRED libdatachannel)
# endif()

# # Find OpenSSL for DTLS
# find_package(OpenSSL REQUIRED)
# # Find nlohmann/json (only if it wasn't provided via the monorepo vendor)
# if(NOT TARGET nlohmann_json::nlohmann_json)
#     find_package(nlohmann_json REQUIRED)
# endif()

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

# Installation
install(TARGETS libllbe
    RUNTIME DESTINATION bin
)

# Generate compile commands for IDEs
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
