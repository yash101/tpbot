# Telepresence Robot Firmware

This firmware is designed for the ESP32-C5 DevKitC v1 and provides:

## Features

- I2C driver for INA228 power monitor with appropriate sampling interval
- SPI driver for TMC5160 stepper motor drivers in chained mode
- Ramp generator control for smooth motor movement
- Read-after-write error detection for SPI communications
- Power management for different subsystems
- FreeRTOS task-based architecture

## Hardware Configuration

### I2C Bus (INA228)
- SDA: GPIO6
- SCL: GPIO7
- Address: 0x40 (default)
- Sampling rate: 100ms (based on ADC conversion time)

### SPI Bus (TMC5160 Chain)
- MISO: GPIO2
- MOSI: GPIO3
- SCLK: GPIO4
- CS: GPIO5
- Chained configuration: U4 -> U5 -> U3 -> U6

### Power Control GPIOs
- GPIO24: High voltage section enable
- GPIO23: Motor driver enable
- GPIO4: Compute subsystem enable (LPGPIO4)

## Build and Flash

1. Set up ESP-IDF environment
2. Set target: `idf.py set-target esp32c5`
3. Configure: `idf.py menuconfig`
4. Build: `idf.py build`
5. Flash: `idf.py flash monitor`

## Project Structure

```
firmware/
├── CMakeLists.txt
├── main/
│   ├── CMakeLists.txt
│   ├── main.c
│   ├── ina228.c/h           # INA228 I2C driver
│   ├── tmc5160.c/h          # TMC5160 SPI driver
│   └── power_management.c/h  # Power subsystem control
├── components/              # Custom components
└── sdkconfig               # ESP-IDF configuration
```
