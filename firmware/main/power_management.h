/**
 * @file power_management.h
 * @brief Power management system for ESP32-C5 Telepresence Robot
 * 
 * Controls the three power domains:
 * - Compute subsystem (GPIO4/LPGPIO4)
 * - High voltage section (GPIO24)  
 * - Motor drivers (GPIO23)
 */

#ifndef POWER_MANAGEMENT_H
#define POWER_MANAGEMENT_H

#include "esp_err.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// GPIO definitions from design doc
#define POWER_GPIO_COMPUTE      4   // GPIO4/LPGPIO4 - compute subsystem enable
#define POWER_GPIO_HIGH_VOLTAGE 24  // GPIO24 - high voltage section enable  
#define POWER_GPIO_MOTOR_ENABLE 23  // GPIO23 - motor driver enable

/**
 * @brief Power management system state
 */
typedef struct {
    bool compute_enabled;       ///< Compute subsystem power state
    bool high_voltage_enabled;  ///< High voltage section power state
    bool motor_drivers_enabled; ///< Motor drivers power state
    uint32_t uptime_ms;        ///< System uptime in milliseconds
} power_mgmt_state_t;

/**
 * @brief Initialize power management system
 * 
 * Configures GPIO pins for power control and sets initial state
 * 
 * @return ESP_OK on success, error code on failure
 */
esp_err_t power_mgmt_init(void);

/**
 * @brief Enable compute subsystem power
 * 
 * CRITICAL: This must be called early in boot to keep system alive
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_enable_compute(void);

/**
 * @brief Disable compute subsystem power
 * 
 * WARNING: This will shut down the entire system
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_disable_compute(void);

/**
 * @brief Enable high voltage section
 * 
 * Enables power to motor drivers and high-power peripherals
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_enable_high_voltage(void);

/**
 * @brief Disable high voltage section
 * 
 * Disables power to motor drivers and high-power peripherals
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_disable_high_voltage(void);

/**
 * @brief Enable motor driver outputs
 * 
 * Enables the output stage of TMC5160 drivers
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_enable_motor_drivers(void);

/**
 * @brief Disable motor driver outputs
 * 
 * Disables the output stage of TMC5160 drivers (safe stop)
 * 
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_disable_motor_drivers(void);

/**
 * @brief Get current power management state
 * 
 * @param state Pointer to store current state
 * @return ESP_OK on success
 */
esp_err_t power_mgmt_get_state(power_mgmt_state_t *state);

/**
 * @brief Update power management system
 * 
 * Should be called periodically to update uptime and check power state
 */
void power_mgmt_update(void);

/**
 * @brief Emergency shutdown sequence
 * 
 * Safely shuts down all power domains in correct order
 */
void power_mgmt_emergency_shutdown(void);

#ifdef __cplusplus
}
#endif

#endif // POWER_MANAGEMENT_H
