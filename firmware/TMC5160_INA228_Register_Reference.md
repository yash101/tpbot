# TMC5160 and INA228 Register Reference

This document provides detailed register information for the TMC5160 stepper motor driver and INA228 power monitor used in the ESP32-C5 Telepresence Robot firmware.

## TMC5160 Stepper Motor Driver Registers

### Communication
- **SPI Mode**: Mode 3 (CPOL=1, CPHA=1)
- **Frequency**: 1 MHz
- **Frame Format**: 5 bytes [Sync][Slave][Register][Data][Data][Data][Data]
- **Chain Support**: SDO of one driver connects to SDI of next

### General Configuration Registers

#### GCONF (0x00) - Global Configuration
| Bit | Name | Description |
|-----|------|-------------|
| 4 | en_pwm_mode | Enable StealthChop PWM mode |
| 3 | multistep_filt | Enable multistep filtering |
| 2 | shaft | Invert motor direction |
| 1 | diag1_pushpull | DIAG1 output configuration |
| 0 | diag0_pushpull | DIAG0 output configuration |

#### GSTAT (0x01) - Global Status
| Bit | Name | Description |
|-----|------|-------------|
| 2 | drv_err | Driver error (clear on read) |
| 1 | uv_cp | Charge pump undervoltage |
| 0 | reset | Reset occurred (clear on read) |

### Current Control Registers

#### IHOLD_IRUN (0x10) - Current Configuration
| Bits | Name | Description |
|------|------|-------------|
| 23:20 | IHOLDDELAY | Hold current delay (0-15) |
| 12:8 | IRUN | Run current (0-31) |
| 4:0 | IHOLD | Hold current (0-31) |

**Current Calculation**: `I_actual = (CS + 1) / 32 * (VFS / R_sense)`
- VFS = 0.325V (typical)
- R_sense = 0.075Ω (typical for SilentStepStick)

#### TPOWERDOWN (0x11) - Power Down Delay
Sets delay time after TSTEP reaches TPOWERDOWN before switching to hold current.

### Ramp Generator Registers

#### RAMPMODE (0x20) - Ramp Mode
| Value | Mode | Description |
|-------|------|-------------|
| 0 | Position | Target position mode |
| 1 | Velocity+ | Positive velocity mode |
| 2 | Velocity- | Negative velocity mode |
| 3 | Hold | Hold mode (motor stopped) |

#### XACTUAL (0x21) - Actual Position
Current motor position in steps (signed 32-bit).

#### VACTUAL (0x22) - Actual Velocity
Current motor velocity in steps/second (signed 24-bit).

#### VSTART (0x23) - Start Velocity
Initial velocity for ramp (0-262143). Recommended: 1-10.

#### A1 (0x24) - First Acceleration
Acceleration below V1 (0-65535).

#### V1 (0x25) - Threshold Velocity
Velocity threshold for A1/D1 transition (0-1048575).

#### AMAX (0x26) - Maximum Acceleration
Maximum acceleration above V1 (0-65535).

#### VMAX (0x27) - Maximum Velocity
Maximum velocity (0-8388607).

#### DMAX (0x28) - Maximum Deceleration
Maximum deceleration above V1 (0-65535).

#### D1 (0x2A) - First Deceleration
Deceleration below V1 (0-65535).

#### VSTOP (0x2B) - Stop Velocity
Velocity below which motor stops (0-262143). Recommended: 1-10.

#### XTARGET (0x2D) - Target Position
Target position for position mode (signed 32-bit).

### Chopper Configuration

#### CHOPCONF (0x6C) - Chopper Configuration
| Bits | Name | Description |
|------|------|-------------|
| 27:24 | MRES | Microstep resolution (0=256, 1=128, ..., 8=1) |
| 19:15 | TBL | Blank time (0-3, recommended: 2) |
| 14 | CHM | Chopper mode (0=SpreadCycle, 1=Constant tOFF) |
| 13:7 | HEND | Hysteresis end value (-3 to 12) |
| 6:4 | HSTRT | Hysteresis start value (1-8) |
| 3:0 | TOFF | Off time (2-15, 0=driver disable) |

### StealthChop Configuration

#### PWMCONF (0x70) - PWM Configuration
| Bits | Name | Description |
|------|------|-------------|
| 31:24 | PWM_LIM | PWM amplitude limit |
| 23:16 | PWM_REG | PWM regulation |
| 15:8 | freewheel | Freewheel mode |
| 7:4 | PWM_AUTOSCALE | PWM automatic scaling |
| 3:0 | PWM_GRAD | PWM gradient |

### Status Registers

#### DRV_STATUS (0x6F) - Driver Status
| Bit | Name | Description |
|-----|------|-------------|
| 31 | stst | Standstill indicator |
| 30 | olb | Open load indicator phase B |
| 29 | ola | Open load indicator phase A |
| 28 | s2gb | Short to ground indicator phase B |
| 27 | s2ga | Short to ground indicator phase A |
| 26 | otpw | Overtemperature prewarning |
| 25 | ot | Overtemperature shutdown |
| 24 | stallGuard | StallGuard status |
| 20:16 | cs_actual | Actual current scaling |
| 9:0 | stallGuard_result | StallGuard measurement |

## INA228 Power Monitor Registers

### Communication
- **I2C Address**: 0x40 (A1=A0=GND), 0x41-0x4F (based on A1,A0 pins)
- **Frequency**: Up to 400 kHz (Fast Mode)
- **Data Format**: 16-bit registers (some 24-bit for measurements)

### Configuration Registers

#### CONFIG (0x00) - Configuration Register
| Bit | Name | Description |
|-----|------|-------------|
| 15 | RST | Reset device |
| 10:6 | CONVDLY | Conversion delay (0-255 × 2ms) |
| 5 | TEMPCOMP | Temperature compensation enable |
| 4 | ADCRANGE | ADC range (0=±163.84mV, 1=±40.96mV) |

#### ADC_CONFIG (0x01) - ADC Configuration
| Bits | Name | Description |
|------|------|-------------|
| 15:12 | MODE | Operating mode |
| 11:9 | VBUSCT | Bus voltage conversion time |
| 8:6 | VSHCT | Shunt voltage conversion time |
| 5:3 | VTCT | Temperature conversion time |
| 2:0 | AVG | Averaging count |

**Operating Modes**:
| Value | Mode | Description |
|-------|------|-------------|
| 0x0 | Shutdown | Power down |
| 0x1 | Trig Bus | Triggered bus voltage |
| 0x2 | Trig Shunt | Triggered shunt voltage |
| 0x3 | Trig Bus+Shunt | Triggered bus and shunt |
| 0x4 | Trig Temp | Triggered temperature |
| 0x9 | Cont Bus | Continuous bus voltage |
| 0xA | Cont Shunt | Continuous shunt voltage |
| 0xB | Cont Bus+Shunt | Continuous bus and shunt |
| 0xF | Cont All | Continuous all measurements |

**Conversion Times**:
| Value | Time | Description |
|-------|------|-------------|
| 0 | 50 μs | Fastest, lowest accuracy |
| 1 | 84 μs | |
| 2 | 150 μs | |
| 3 | 280 μs | |
| 4 | 540 μs | |
| 5 | 1.052 ms | Good balance (default) |
| 6 | 2.074 ms | |
| 7 | 4.120 ms | Highest accuracy |

**Averaging Counts**:
| Value | Samples | Description |
|-------|---------|-------------|
| 0 | 1 | No averaging |
| 1 | 4 | Light filtering |
| 2 | 16 | Good filtering (default) |
| 3 | 64 | Heavy filtering |
| 4 | 128 | Maximum filtering |
| 5 | 256 | |
| 6 | 512 | |
| 7 | 1024 | Extreme filtering |

### Calibration Registers

#### SHUNT_CAL (0x02) - Shunt Calibration
Calibration register to scale current measurement. 
Formula: `CAL = 0.00512 / (Current_LSB × R_shunt)`

### Measurement Registers (Read-Only)

#### VSHUNT (0x04) - Shunt Voltage Measurement
16-bit signed value. LSB = 312.5 nV (±163.84mV range) or 78.125 nV (±40.96mV range).

#### VBUS (0x05) - Bus Voltage Measurement  
16-bit unsigned value. LSB = 195.3125 μV. Range: 0 to 85V.

#### DIETEMP (0x06) - Die Temperature
16-bit signed value. LSB = 7.8125 m°C.

#### CURRENT (0x07) - Current Measurement
24-bit signed value. LSB = user-defined based on calibration.

#### POWER (0x08) - Power Measurement
24-bit signed value. LSB = 3.2 × Current_LSB.

#### ENERGY (0x09) - Energy Accumulator
40-bit signed accumulator. Accumulates power measurements.

#### CHARGE (0x0A) - Charge Accumulator  
40-bit signed accumulator. Accumulates current measurements.

### Alert and Threshold Registers

#### DIAG_ALRT (0x0B) - Diagnostic Flags and Alert
| Bit | Name | Description |
|-----|------|-------------|
| 15 | ALATCH | Alert latch enable |
| 14 | CNVR | Conversion ready |
| 13 | SLOWALERT | Slow alert flag |
| 12 | APOL | Alert polarity |
| 4 | MATHOF | Math overflow |
| 3 | CHARGEOF | Charge overflow |
| 2 | ENERGYOF | Energy overflow |
| 1 | TEMPOL | Temperature over-limit |
| 0 | SHNTOL | Shunt over-limit |

### Device Identification

#### MANUFACTURER_ID (0x3E) - Manufacturer ID
Always reads 0x5449 ("TI" in ASCII).

#### DEVICE_ID (0x3F) - Device ID  
Bits 11:0 = 0x228 for INA228.

## Register Access Timing

### INA228 Timing Requirements
- **Conversion Time**: Based on ADC_CONFIG settings
- **Total Cycle Time**: (VBUS_CT + VSHUNT_CT + TEMP_CT) × AVG_COUNT
- **I2C Setup Time**: 100 ns minimum
- **Recommended Polling**: Every 100ms with default settings

### TMC5160 Timing Requirements
- **SPI Clock**: Up to 4 MHz (1 MHz recommended)
- **Setup/Hold Time**: 10 ns minimum  
- **Read-After-Write Delay**: 1ms recommended for verification
- **Ramp Update Rate**: Internal 16 MHz clock (62.5 ns resolution)

## Typical Configuration Values

### INA228 Battery Monitor Setup
```c
// Configuration for 20A max, 1mΩ shunt
CONFIG = 0x0010;           // Temperature compensation enabled
ADC_CONFIG = 0xFB68;       // Continuous all, 1.052ms, 16 avg
SHUNT_CAL = 0x0A00;        // Calibrated for 1mΩ, 20A range
```

### TMC5160 NEMA17 Setup  
```c
// Configuration for NEMA17, 16 microsteps, 1A
GCONF = 0x0010;            // StealthChop enabled
CHOPCONF = 0x10000053;     // 16 microsteps, SpreadCycle 
IHOLD_IRUN = 0x0A1010;     // 1A run, 0.5A hold
AMAX = 0x2710;             // 10000 steps/s² acceleration
VMAX = 0x30D40;            // 200000 steps/s max velocity
```

This register reference provides the essential information needed to configure and monitor both the TMC5160 motor drivers and INA228 power monitor in the telepresence robot firmware.
