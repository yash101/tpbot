add_library(libllbe OBJECT
    config.cpp
    logger.cpp
#    dtls_server.cpp
#    connection_handler.cpp
)

add_executable(${PROJECT_NAME}
    main.cpp
    $<TARGET_OBJECTS:libllbe>
)

