# ESP32-C5 Telepresence Robot - Quick Setup Guide

## Prerequisites

1. **ESP-IDF Installation**: Install ESP-IDF v5.1 or later
   ```bash
   # For macOS/Linux
   mkdir -p ~/esp
   cd ~/esp
   git clone --recursive https://github.com/espressif/esp-idf.git
   cd esp-idf
   ./install.sh esp32c5
   . ./export.sh
   ```

2. **Hardware Requirements**:
   - ESP32-C5 DevKitC v1
   - INA228 power monitor on I2C bus
   - TMC5160 motor drivers in SPI chain
   - NEMA17 stepper motors
   - Appropriate power supply and wiring

## Quick Start

### 1. Environment Setup
```bash
# Source ESP-IDF environment (run this in each new terminal)
. $HOME/esp/esp-idf/export.sh

# Navigate to firmware directory
cd /path/to/telepresence-robot/firmware
```

### 2. Build Firmware
```bash
# Build the firmware
./build.sh

# Or manually:
idf.py set-target esp32c5
idf.py build
```

### 3. Flash and Monitor
```bash
# Find your serial port (macOS example)
ls /dev/cu.*

# Flash and monitor (replace with your port)
idf.py -p /dev/cu.usbserial-0001 flash monitor

# Or use VS Code task: Ctrl+Shift+P > "Tasks: Run Task" > "ESP-IDF Build"
```

### 4. Expected Output
```
I (123) MAIN: Starting Telepresence Robot Firmware
I (124) MAIN: ESP32-C5 DevKitC v1
I (125) POWER_MGMT: Initializing power management system
I (130) POWER_MGMT: Enabling compute subsystem power
I (135) POWER_MGMT: Enabling high voltage section
I (140) POWER_MGMT: Enabling motor drivers
I (245) INA228: Initializing INA228 driver
I (350) INA228: INA228 device detected and verified
I (355) TMC5160: Initializing TMC5160 SPI driver
I (455) TMC5160: Detected 4 TMC5160 drivers
I (460) MAIN: Hardware initialization complete
I (465) MAIN: All tasks created
I (470) MAIN: Firmware initialization complete
```

## Configuration

### Hardware Pin Mapping
- **I2C (INA228)**: SDA=GPIO6, SCL=GPIO7
- **SPI (TMC5160)**: MISO=GPIO2, MOSI=GPIO3, SCLK=GPIO4, CS=GPIO5  
- **Power Control**: Compute=GPIO4, High Voltage=GPIO24, Motors=GPIO23

### Default Settings
- **INA228**: 10Hz sampling, 16-sample averaging, continuous measurement
- **TMC5160**: 16 microsteps, 1A run current, StealthChop enabled
- **Tasks**: Power management (1Hz), INA228 (10Hz), TMC5160 (20Hz)

## Troubleshooting

### Build Issues
```bash
# Clean and rebuild
idf.py clean
idf.py build

# Check ESP-IDF version
idf.py --version

# Reconfigure if needed
idf.py reconfigure
```

### Hardware Issues
1. **No INA228 detected**: Check I2C wiring and address
2. **No TMC5160 response**: Verify SPI connections and power
3. **Motors not moving**: Check power domains and current settings

### Monitoring and Debugging
```bash
# View logs only
idf.py -p /dev/cu.usbserial-0001 monitor

# Flash without monitoring
idf.py -p /dev/cu.usbserial-0001 flash

# Erase flash completely
idf.py -p /dev/cu.usbserial-0001 erase-flash
```

## Next Steps

1. **Test Basic Functions**: Verify power monitoring and motor movement
2. **Tune Parameters**: Adjust current, velocity, and acceleration settings
3. **Add Communication**: Implement WiFi or other communication protocols
4. **Develop Control Logic**: Add higher-level robot control algorithms

## Additional Resources

- [ESP-IDF Documentation](https://docs.espressif.com/projects/esp-idf/en/latest/)
- [TMC5160 Datasheet](https://www.trinamic.com/products/integrated-circuits/details/tmc5160/)
- [INA228 Datasheet](https://www.ti.com/product/INA228)
- [Firmware Documentation](./FIRMWARE_DOCUMENTATION.md)
- [Register Reference](./TMC5160_INA228_Register_Reference.md)

For support, refer to the detailed documentation files or check the hardware connections against the design documentation.
