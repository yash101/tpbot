/**
 * @file main.c
 * @brief Main application for ESP32-C5 Telepresence Robot
 * 
 * This application initializes and manages:
 * - Power management system
 * - INA228 power monitor via I2C
 * - TMC5160 motor drivers via SPI
 * - FreeRTOS tasks for periodic operations
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/timers.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_err.h"
#include "driver/gpio.h"

#include "power_management.h"
#include "ina228.h"
#include "tmc5160.h"

static const char *TAG = "MAIN";

/**
 * @brief INA228 monitoring task
 * 
 * Reads battery voltage, current, and power consumption
 * at 100ms intervals (10Hz) based on INA228 ADC conversion time
 */
static void ina228_task(void *pvParameters)
{
    float voltage, current, power;
    
    while (1) {
        if (ina228_read_measurements(&voltage, &current, &power) == ESP_OK) {
            ESP_LOGI(TAG, "Battery: %.2fV, %.2fA, %.2fW", voltage, current, power);
            
            // Check for low battery or overcurrent conditions
            if (voltage < 10.5f) {  // Adjust threshold based on battery chemistry
                ESP_LOGW(TAG, "Low battery voltage detected!");
            }
            if (current > 15.0f) {  // Adjust based on system current limits
                ESP_LOGW(TAG, "High current consumption detected!");
            }
        } else {
            ESP_LOGE(TAG, "Failed to read INA228 measurements");
        }
        
        // Sleep for 100ms - based on INA228 ADC conversion time
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

/**
 * @brief TMC5160 control task
 * 
 * Handles motor control commands and status monitoring
 */
static void tmc5160_task(void *pvParameters)
{
    tmc5160_status_t status;
    
    while (1) {
        // Read status from all drivers in chain
        if (tmc5160_read_status_all(&status) == ESP_OK) {
            ESP_LOGD(TAG, "TMC5160 Status - Drivers active: %d", status.drivers_active);
            
            // Check for any driver errors
            for (int i = 0; i < TMC5160_MAX_DRIVERS; i++) {
                if (status.driver_status[i].error_flags != 0) {
                    ESP_LOGW(TAG, "Driver %d error flags: 0x%02X", i, status.driver_status[i].error_flags);
                }
            }
        }
        
        // Process any pending movement commands here
        // This would interface with communication system
        
        vTaskDelay(pdMS_TO_TICKS(50)); // 20Hz update rate
    }
}

/**
 * @brief Power management task
 * 
 * Monitors system power state and manages power sequencing
 */
static void power_management_task(void *pvParameters)
{
    while (1) {
        power_mgmt_update();
        
        // Check if we need to shut down due to low battery
        // or implement sleep modes
        
        vTaskDelay(pdMS_TO_TICKS(1000)); // 1Hz update rate
    }
}

/**
 * @brief Initialize all hardware peripherals
 */
static esp_err_t init_hardware(void)
{
    esp_err_t ret = ESP_OK;
    
    ESP_LOGI(TAG, "Initializing hardware...");
    
    // Initialize power management first
    ret = power_mgmt_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize power management: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Enable power to compute subsystem (keep ourselves alive)
    power_mgmt_enable_compute();
    
    // Enable high voltage section
    power_mgmt_enable_high_voltage();
    
    // Enable motor drivers
    power_mgmt_enable_motor_drivers();
    
    // Small delay to allow power to stabilize
    vTaskDelay(pdMS_TO_TICKS(100));
    
    // Initialize INA228 I2C driver
    ret = ina228_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize INA228: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Initialize TMC5160 SPI driver
    ret = tmc5160_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize TMC5160: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(TAG, "Hardware initialization complete");
    return ESP_OK;
}

/**
 * @brief Create and start FreeRTOS tasks
 */
static void create_tasks(void)
{
    // Create INA228 monitoring task
    xTaskCreate(ina228_task, "ina228_task", 4096, NULL, 5, NULL);
    
    // Create TMC5160 control task
    xTaskCreate(tmc5160_task, "tmc5160_task", 4096, NULL, 6, NULL);
    
    // Create power management task
    xTaskCreate(power_management_task, "power_mgmt_task", 2048, NULL, 4, NULL);
    
    ESP_LOGI(TAG, "All tasks created");
}

/**
 * @brief Main application entry point
 */
void app_main(void)
{
    ESP_LOGI(TAG, "Starting Telepresence Robot Firmware");
    ESP_LOGI(TAG, "ESP32-C5 DevKitC v1");
    
    // Initialize hardware
    esp_err_t ret = init_hardware();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Hardware initialization failed, restarting...");
        esp_restart();
    }
    
    // Create and start tasks
    create_tasks();
    
    ESP_LOGI(TAG, "Firmware initialization complete");
    
    // Main loop - could be used for communication handling
    while (1) {
        vTaskDelay(pdMS_TO_TICKS(10000)); // 10 second heartbeat
        ESP_LOGI(TAG, "System running normally");
    }
}
