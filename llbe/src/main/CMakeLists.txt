add_library(libllbe OBJECT
    config.cpp
    logger.cpp
    trunk.cpp
    udp.cpp
    llbe.cpp
    sha256.cpp
)

add_executable(${PROJECT_NAME}
    main.cpp
    $<TARGET_OBJECTS:libllbe>
)
