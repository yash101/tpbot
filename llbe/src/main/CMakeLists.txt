add_library(libllbe STATIC
    config.cpp
    logger.cpp
    trunk.cpp
    udp.cpp
    llbe.cpp
    sha256.cpp
)

add_executable(${PROJECT_NAME}
    main.cpp
)

# Link executable to the library so its link interface is used
target_link_libraries(${PROJECT_NAME} PRIVATE libllbe)
