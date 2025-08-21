/**
 * @file tmc5160.h
 * @brief TMC5160 SPI Stepper Motor Driver
 * 
 * Driver for Trinamic TMC5160 stepper motor controller with integrated
 * ramp generator. Supports chained SPI configuration for multiple drivers.
 * 
 * Features:
 * - SPI communication with read-after-write verification
 * - Chain configuration support (multiple drivers on same SPI bus)
 * - Integrated ramp generator for smooth motion profiles
 * - StallGuard load detection
 * - CoolStep current regulation
 */

#ifndef TMC5160_H
#define TMC5160_H

#include "esp_err.h"
#include <stdbool.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// SPI Configuration
#define TMC5160_SPI_HOST           SPI2_HOST
#define TMC5160_SPI_MISO_GPIO      2        ///< SPI MISO GPIO pin
#define TMC5160_SPI_MOSI_GPIO      3        ///< SPI MOSI GPIO pin  
#define TMC5160_SPI_SCLK_GPIO      4        ///< SPI SCLK GPIO pin
#define TMC5160_SPI_CS_GPIO        5        ///< SPI CS GPIO pin
#define TMC5160_SPI_FREQ_HZ        1000000  ///< SPI frequency (1MHz)

// Chain Configuration (based on PCB layout)
#define TMC5160_MAX_DRIVERS        4        ///< Maximum drivers in chain
#define TMC5160_DRIVER_LEFT_REAR   0        ///< U4 - Left rear motor
#define TMC5160_DRIVER_LEFT_FRONT  1        ///< U5 - Left front motor  
#define TMC5160_DRIVER_RIGHT_REAR  2        ///< U3 - Right rear motor
#define TMC5160_DRIVER_RIGHT_FRONT 3        ///< U6 - Right front motor

// Register Addresses
#define TMC5160_REG_GCONF          0x00     ///< Global configuration
#define TMC5160_REG_GSTAT          0x01     ///< Global status
#define TMC5160_REG_IFCNT          0x02     ///< Interface transmission counter
#define TMC5160_REG_SLAVECONF      0x03     ///< Slave configuration
#define TMC5160_REG_IOIN           0x04     ///< Input/Output pins status

// Motor configuration registers
#define TMC5160_REG_X_COMPARE      0x05     ///< Position compare register
#define TMC5160_REG_OTP_PROG       0x06     ///< OTP programming register
#define TMC5160_REG_OTP_READ       0x07     ///< OTP read register
#define TMC5160_REG_FACTORY_CONF   0x08     ///< Factory configuration
#define TMC5160_REG_SHORT_CONF     0x09     ///< Short detector configuration
#define TMC5160_REG_DRV_CONF       0x0A     ///< Driver configuration
#define TMC5160_REG_GLOBAL_SCALER  0x0B     ///< Global scaling of motor current

// Ramp generator registers
#define TMC5160_REG_RAMPMODE       0x20     ///< Ramp mode
#define TMC5160_REG_XACTUAL        0x21     ///< Actual motor position
#define TMC5160_REG_VACTUAL        0x22     ///< Actual motor velocity
#define TMC5160_REG_VSTART         0x23     ///< Start velocity
#define TMC5160_REG_A1             0x24     ///< First acceleration
#define TMC5160_REG_V1             0x25     ///< First acceleration/deceleration period threshold velocity
#define TMC5160_REG_AMAX           0x26     ///< Maximum acceleration
#define TMC5160_REG_VMAX           0x27     ///< Maximum velocity
#define TMC5160_REG_DMAX           0x28     ///< Maximum deceleration
#define TMC5160_REG_D1             0x2A     ///< Deceleration above V1
#define TMC5160_REG_VSTOP          0x2B     ///< Stop velocity
#define TMC5160_REG_TZEROWAIT      0x2C     ///< Zero wait time
#define TMC5160_REG_XTARGET        0x2D     ///< Target position

// Ramp status registers
#define TMC5160_REG_VDCMIN         0x33     ///< Velocity-dependent control
#define TMC5160_REG_SW_MODE        0x34     ///< Switch mode configuration
#define TMC5160_REG_RAMP_STAT      0x35     ///< Ramp status
#define TMC5160_REG_XLATCH         0x36     ///< Ramp position latch

// Motor driver registers
#define TMC5160_REG_CHOPCONF       0x6C     ///< Chopper configuration
#define TMC5160_REG_COOLCONF       0x6D     ///< CoolStep control
#define TMC5160_REG_DCCTRL         0x6E     ///< DC step control
#define TMC5160_REG_DRV_STATUS     0x6F     ///< Driver status
#define TMC5160_REG_PWMCONF        0x70     ///< PWM mode configuration
#define TMC5160_REG_PWM_SCALE      0x71     ///< PWM scale
#define TMC5160_REG_PWM_AUTO       0x72     ///< PWM automatic scale
#define TMC5160_REG_LOST_STEPS     0x73     ///< Lost steps counter

// Current control registers  
#define TMC5160_REG_IHOLD_IRUN     0x10     ///< Hold current, run current, delay
#define TMC5160_REG_TPOWERDOWN     0x11     ///< Power down delay
#define TMC5160_REG_TSTEP          0x12     ///< Time between steps
#define TMC5160_REG_TPWMTHRS       0x13     ///< StealthChop PWM mode threshold
#define TMC5160_REG_TCOOLTHRS      0x14     ///< CoolStep threshold
#define TMC5160_REG_THIGH          0x15     ///< High velocity threshold

// Ramp modes
typedef enum {
    TMC5160_RAMP_MODE_POSITION = 0,  ///< Position mode (target position)
    TMC5160_RAMP_MODE_VELOCITY = 1,  ///< Velocity mode (continuous rotation)
    TMC5160_RAMP_MODE_HOLD = 2,      ///< Hold mode (motor stopped)
} tmc5160_ramp_mode_t;

// Driver configuration structure
typedef struct {
    uint8_t driver_id;              ///< Driver ID in chain (0-3)
    uint16_t microsteps;            ///< Microstepping resolution (1,2,4,8,16,32,64,128,256)
    uint16_t run_current_ma;        ///< Run current in mA (0-3000)
    uint16_t hold_current_ma;       ///< Hold current in mA (0-3000)
    uint32_t max_velocity;          ///< Maximum velocity in steps/s
    uint32_t max_acceleration;      ///< Maximum acceleration in steps/s²
    bool stealthchop_enabled;       ///< Enable StealthChop (quiet operation)
    bool coolstep_enabled;          ///< Enable CoolStep (automatic current regulation)
    bool stallguard_enabled;        ///< Enable StallGuard (load detection)
} tmc5160_driver_config_t;

// Driver status structure
typedef struct {
    bool stst;                      ///< Standstill indicator
    bool olb;                       ///< Open load indicator phase B
    bool ola;                       ///< Open load indicator phase A  
    bool s2gb;                      ///< Short to ground indicator phase B
    bool s2ga;                      ///< Short to ground indicator phase A
    bool otpw;                      ///< Overtemperature prewarning
    bool ot;                        ///< Overtemperature shutdown
    bool stallguard;                ///< StallGuard status
    uint16_t stallguard_result;     ///< StallGuard measurement result
    uint8_t cs_actual;              ///< Actual current scaling
    bool stealth_active;            ///< StealthChop mode active
    uint8_t error_flags;            ///< Combined error flags
} tmc5160_driver_status_t;

// System status structure  
typedef struct {
    uint8_t drivers_active;                                   ///< Number of active drivers
    tmc5160_driver_status_t driver_status[TMC5160_MAX_DRIVERS]; ///< Individual driver status
    uint32_t communication_errors;                           ///< Total communication errors
    uint32_t last_update_ms;                                 ///< Last status update timestamp
} tmc5160_status_t;

// Motion parameters structure
typedef struct {
    int32_t target_position;        ///< Target position in steps
    int32_t current_position;       ///< Current position in steps
    int32_t current_velocity;       ///< Current velocity in steps/s
    uint32_t acceleration;          ///< Acceleration in steps/s²
    uint32_t max_velocity;          ///< Maximum velocity in steps/s
    tmc5160_ramp_mode_t ramp_mode;  ///< Current ramp mode
    bool motion_complete;           ///< Motion completion flag
} tmc5160_motion_params_t;

/**
 * @brief Initialize TMC5160 SPI driver and chain
 * 
 * Initializes SPI bus and configures all TMC5160 drivers in the chain
 * with default settings suitable for NEMA17 stepper motors.
 * 
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_init(void);

/**
 * @brief Configure a specific driver in the chain
 * 
 * @param config Pointer to driver configuration
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_configure_driver(const tmc5160_driver_config_t *config);

/**
 * @brief Set target position for a driver (position mode)
 * 
 * @param driver_id Driver ID (0-3)
 * @param position Target position in steps
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_set_target_position(uint8_t driver_id, int32_t position);

/**
 * @brief Set target velocity for a driver (velocity mode)
 * 
 * @param driver_id Driver ID (0-3)  
 * @param velocity Target velocity in steps/s (signed)
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_set_target_velocity(uint8_t driver_id, int32_t velocity);

/**
 * @brief Stop a driver immediately
 * 
 * @param driver_id Driver ID (0-3)
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_stop_motor(uint8_t driver_id);

/**
 * @brief Read current position from a driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param position Pointer to store current position
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_get_current_position(uint8_t driver_id, int32_t *position);

/**
 * @brief Read current velocity from a driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param velocity Pointer to store current velocity
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_get_current_velocity(uint8_t driver_id, int32_t *velocity);

/**
 * @brief Read status from all drivers in chain
 * 
 * @param status Pointer to store system status
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_read_status_all(tmc5160_status_t *status);

/**
 * @brief Read status from a specific driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param status Pointer to store driver status
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_read_driver_status(uint8_t driver_id, tmc5160_driver_status_t *status);

/**
 * @brief Get motion parameters for a driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param params Pointer to store motion parameters
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_get_motion_params(uint8_t driver_id, tmc5160_motion_params_t *params);

/**
 * @brief Set ramp mode for a driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param mode Ramp mode
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_set_ramp_mode(uint8_t driver_id, tmc5160_ramp_mode_t mode);

/**
 * @brief Set current scaling for a driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param run_current_ma Run current in mA
 * @param hold_current_ma Hold current in mA
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_set_current(uint8_t driver_id, uint16_t run_current_ma, uint16_t hold_current_ma);

/**
 * @brief Enable/disable a specific driver
 * 
 * @param driver_id Driver ID (0-3)
 * @param enable true to enable, false to disable
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_enable_driver(uint8_t driver_id, bool enable);

/**
 * @brief Emergency stop all drivers
 * 
 * Immediately stops all motors and disables drivers
 * 
 * @return ESP_OK on success, error code on failure
 */
esp_err_t tmc5160_emergency_stop(void);

/**
 * @brief Reset all drivers to default configuration
 * 
 * @return ESP_OK on success, error code on failure  
 */
esp_err_t tmc5160_reset_all(void);

/**
 * @brief Check communication with all drivers
 * 
 * Verifies that all drivers in the chain are responding correctly
 * 
 * @param drivers_detected Pointer to store number of detected drivers
 * @return ESP_OK if all expected drivers respond, error code otherwise
 */
esp_err_t tmc5160_check_communication(uint8_t *drivers_detected);

#ifdef __cplusplus
}
#endif

#endif // TMC5160_H
