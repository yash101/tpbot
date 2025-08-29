add_library(libllbe OBJECT
    config.cpp
    logger.cpp
    webrtc.cpp
    trunk.cpp
    udp.cpp
)

add_executable(${PROJECT_NAME}
    main.cpp
    $<TARGET_OBJECTS:libllbe>
)
