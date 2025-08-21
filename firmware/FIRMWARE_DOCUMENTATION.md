# ESP32-C5 Telepresence Robot Firmware Documentation

## Overview

This firmware implements a complete control system for the ESP32-C5 based telepresence robot, featuring:

- **Power Management**: Three-domain power control system
- **INA228 Power Monitor**: Battery voltage, current, and power monitoring via I2C
- **TMC5160 Motor Control**: Stepper motor control via chained SPI with ramp generation
- **Real-time Operation**: FreeRTOS-based task architecture for responsive control

## Hardware Architecture

### Power Domains
The system uses three independently controlled power domains:

1. **Compute Domain (GPIO4/LPGPIO4)**: Powers the ESP32-C5 and control electronics
2. **High Voltage Domain (GPIO24)**: Powers the motor drivers and high-power peripherals  
3. **Motor Enable Domain (GPIO23)**: Controls the output stage of TMC5160 drivers

### I2C Bus (INA228 Power Monitor)
- **SDA**: GPIO6
- **SCL**: GPIO7  
- **Address**: 0x40 (default, configurable via A1/A0 pins)
- **Frequency**: 400 kHz
- **Function**: Battery monitoring, coulomb counting, safety oversight

### SPI Bus (TMC5160 Motor Drivers)
- **MISO**: GPIO2
- **MOSI**: GPIO3
- **SCLK**: GPIO4  
- **CS**: GPIO5
- **Frequency**: 1 MHz
- **Configuration**: Chained (daisy-chain) topology
- **Chain Order**: U4 → U5 → U3 → U6

## Software Architecture

### Task Structure

#### Main Application (`main.c`)
- System initialization and coordination
- Hardware bring-up sequence
- Task creation and management
- Heartbeat and system health monitoring

#### Power Management Task (`power_management.c/h`)
- **Priority**: 4 (medium)
- **Stack**: 2048 bytes
- **Period**: 1000ms (1 Hz)
- **Function**: Power domain control, safety monitoring, emergency shutdown

#### INA228 Monitoring Task
- **Priority**: 5 (high)  
- **Stack**: 4096 bytes
- **Period**: 100ms (10 Hz)
- **Function**: Battery monitoring, current/voltage/power measurements
- **Safety**: Low voltage and overcurrent detection

#### TMC5160 Control Task
- **Priority**: 6 (highest)
- **Stack**: 4096 bytes
- **Period**: 50ms (20 Hz)
- **Function**: Motor control, status monitoring, error detection

### Driver Architecture

#### INA228 Driver Features
- **Automatic Calibration**: Self-configuring based on shunt resistor value
- **Multi-mode Operation**: Supports all INA228 measurement modes
- **Temperature Compensation**: Automatic drift correction
- **Error Detection**: I2C communication verification
- **Flexible Timing**: Configurable conversion times and averaging

Key Functions:
```c
esp_err_t ina228_init(void);
esp_err_t ina228_read_measurements(float *voltage, float *current, float *power);
esp_err_t ina228_read_measurements_detailed(ina228_measurements_t *measurements);
uint32_t ina228_get_conversion_time_ms(void);
```

#### TMC5160 Driver Features
- **Chained Communication**: Support for up to 4 drivers on single SPI bus
- **Read-After-Write Verification**: Ensures reliable communication
- **Ramp Generator Control**: Hardware-accelerated motion profiles
- **StealthChop Support**: Quiet operation mode
- **CoolStep Integration**: Automatic current optimization
- **Comprehensive Status**: Real-time driver health monitoring

Key Functions:
```c
esp_err_t tmc5160_init(void);
esp_err_t tmc5160_set_target_position(uint8_t driver_id, int32_t position);
esp_err_t tmc5160_set_target_velocity(uint8_t driver_id, int32_t velocity);
esp_err_t tmc5160_read_status_all(tmc5160_status_t *status);
```

## Configuration and Tuning

### INA228 Configuration
Default settings optimized for battery monitoring:
- **Mode**: Continuous all measurements (bus, shunt, temperature)
- **Conversion Time**: 1.052ms (good accuracy/speed balance)
- **Averaging**: 16 samples (noise reduction)
- **ADC Range**: ±163.84mV (suitable for high currents)
- **Sampling Rate**: 100ms (10 Hz)

### TMC5160 Configuration  
Default settings optimized for NEMA17 steppers:
- **Microsteps**: 16 (good resolution/torque balance)
- **Run Current**: 1000mA (1A, typical for NEMA17)
- **Hold Current**: 500mA (0.5A, energy efficient)
- **Max Velocity**: 200,000 steps/s
- **Max Acceleration**: 10,000 steps/s²
- **StealthChop**: Enabled (quiet operation)
- **CoolStep**: Enabled (automatic current regulation)

### Power Management Sequence
1. **Boot**: Compute domain enabled (keep-alive)
2. **Initialization**: High voltage domain enabled
3. **Motor Activation**: Motor driver outputs enabled
4. **Operation**: All domains active
5. **Emergency**: Reverse shutdown sequence

## Communication Protocols

### I2C (INA228)
- **Speed**: 400 kHz Fast Mode
- **Error Handling**: Automatic retry on communication failure
- **Data Integrity**: Register read-back verification
- **Power**: Can operate at 3.3V logic levels

### SPI (TMC5160)
- **Mode**: Mode 3 (CPOL=1, CPHA=1)
- **Frame Format**: 5-byte frames [Sync][Slave][Reg][Data32]
- **Chaining**: Data shifts through all drivers to reach target
- **Verification**: Read-after-write for critical registers
- **Error Detection**: Communication error counting

## Safety Features

### Power Management Safety
- **Brown-out Protection**: Low voltage detection and shutdown
- **Overcurrent Protection**: Current limit monitoring
- **Thermal Protection**: Temperature monitoring and limiting
- **Emergency Shutdown**: Safe power-down sequence
- **Watchdog**: System reset on task failure

### Motor Safety
- **StallGuard**: Load detection and stall prevention
- **Thermal Monitoring**: Driver temperature protection
- **Short Circuit Detection**: Phase-to-phase and phase-to-ground
- **Open Load Detection**: Disconnected motor detection
- **Position Limits**: Software position boundaries

### System Safety
- **Task Watchdog**: Automatic reset on task hang
- **Communication Monitoring**: Error counting and recovery
- **Status Reporting**: Comprehensive system health reporting
- **Graceful Degradation**: Continue operation with reduced functionality

## Performance Characteristics

### Timing Performance
- **INA228 Update Rate**: 10 Hz (100ms intervals)
- **TMC5160 Update Rate**: 20 Hz (50ms intervals)
- **Power Management Rate**: 1 Hz (1s intervals)
- **System Latency**: <10ms for motor commands
- **Communication Overhead**: <5% CPU utilization

### Motion Performance
- **Position Resolution**: 1/16 step (0.1125° for NEMA17)
- **Velocity Range**: 0 to 200,000 steps/s
- **Acceleration Range**: 0 to 65,535 steps/s²
- **Position Accuracy**: ±1 step under normal conditions
- **Smoothness**: Hardware ramp generation eliminates jerk

### Power Monitoring Performance  
- **Voltage Resolution**: 195.3 μV/bit
- **Current Resolution**: Programmable based on shunt and range
- **Power Resolution**: 3.2 × current resolution
- **Update Rate**: 10 Hz with 16-sample averaging
- **Accuracy**: ±0.1% typical (after calibration)

## Troubleshooting

### Common Issues

#### INA228 Not Detected
1. Check I2C wiring (SDA/SCL swapped?)
2. Verify pull-up resistors (2.2kΩ typical)
3. Confirm power supply (3.3V)
4. Check I2C address (A1/A0 pin configuration)

#### TMC5160 Communication Errors
1. Verify SPI wiring and chain order
2. Check SPI mode and frequency settings
3. Ensure proper power sequencing
4. Verify enable pin states

#### Motor Not Moving
1. Check power domain enables (GPIO23, GPIO24)
2. Verify motor wiring and connections
3. Check current settings (IRUN register)
4. Confirm ramp parameters are reasonable

#### High Current Consumption
1. Check motor current settings (reduce if needed)
2. Verify StealthChop configuration
3. Enable CoolStep for automatic regulation
4. Check for mechanical binding

### Debugging Tools

#### Serial Logging
- Use `idf.py monitor` for real-time log viewing
- Log levels: ERROR, WARN, INFO, DEBUG
- Component-specific filtering available

#### Register Dumps
- TMC5160 status registers provide detailed driver state
- INA228 measurement registers show real-time power data
- Configuration verification through read-back

#### Performance Monitoring
- Task stack usage monitoring
- Communication error counters
- System uptime and reset tracking

## Future Enhancements

### Potential Improvements
1. **Wireless Communication**: WiFi/Bluetooth integration
2. **Advanced Motion**: Path planning and trajectory optimization
3. **Sensor Integration**: Additional sensors for navigation
4. **Power Optimization**: Dynamic power management and sleep modes
5. **Diagnostics**: Enhanced error reporting and recovery

### Scalability
- Additional TMC5160 drivers can be added to chain
- Multiple INA228 devices can monitor different power rails
- Modular driver architecture allows easy expansion
- GPIO pins available for additional sensors/actuators

This firmware provides a robust foundation for the telepresence robot with room for future expansion and enhancement.
