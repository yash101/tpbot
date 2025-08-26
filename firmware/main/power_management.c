/**
 * @file power_management.c
 * @brief Power management system implementation
 */

#include "power_management.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include <string.h>

static const char *TAG = "POWER_MGMT";
static power_mgmt_state_t g_power_state = {0};
static uint32_t g_init_time_ms = 0;

/**
 * @brief Configure a GPIO pin for power control output
 */
static esp_err_t configure_power_gpio(gpio_num_t gpio_num)
{
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE,
        .mode = GPIO_MODE_OUTPUT,
        .pin_bit_mask = (1ULL << gpio_num),
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .pull_up_en = GPIO_PULLUP_DISABLE,
    };
    
    esp_err_t ret = gpio_config(&io_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure GPIO %d: %s", gpio_num, esp_err_to_name(ret));
        return ret;
    }
    
    // Start with GPIO low (power off)
    gpio_set_level(gpio_num, 0);
    ESP_LOGD(TAG, "Configured power GPIO %d", gpio_num);
    
    return ESP_OK;
}

esp_err_t power_mgmt_init(void)
{
    ESP_LOGI(TAG, "Initializing power management system");
    
    // Record initialization time
    g_init_time_ms = xTaskGetTickCount() * portTICK_PERIOD_MS;
    
    // Initialize power state
    memset(&g_power_state, 0, sizeof(g_power_state));
    
    // Configure power control GPIOs
    esp_err_t ret;
    
    ret = configure_power_gpio(POWER_GPIO_COMPUTE);
    if (ret != ESP_OK) return ret;
    
    ret = configure_power_gpio(POWER_GPIO_HIGH_VOLTAGE);
    if (ret != ESP_OK) return ret;
    
    ret = configure_power_gpio(POWER_GPIO_MOTOR_ENABLE);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGI(TAG, "Power management initialized");
    return ESP_OK;
}

esp_err_t power_mgmt_enable_compute(void)
{
    ESP_LOGI(TAG, "Enabling compute subsystem power");
    gpio_set_level(POWER_GPIO_COMPUTE, 1);
    g_power_state.compute_enabled = true;
    return ESP_OK;
}

esp_err_t power_mgmt_disable_compute(void)
{
    ESP_LOGW(TAG, "Disabling compute subsystem power - SYSTEM WILL SHUTDOWN!");
    gpio_set_level(POWER_GPIO_COMPUTE, 0);
    g_power_state.compute_enabled = false;
    return ESP_OK;
}

esp_err_t power_mgmt_enable_high_voltage(void)
{
    ESP_LOGI(TAG, "Enabling high voltage section");
    gpio_set_level(POWER_GPIO_HIGH_VOLTAGE, 1);
    g_power_state.high_voltage_enabled = true;
    return ESP_OK;
}

esp_err_t power_mgmt_disable_high_voltage(void)
{
    ESP_LOGI(TAG, "Disabling high voltage section");
    gpio_set_level(POWER_GPIO_HIGH_VOLTAGE, 0);
    g_power_state.high_voltage_enabled = false;
    return ESP_OK;
}

esp_err_t power_mgmt_enable_motor_drivers(void)
{
    ESP_LOGI(TAG, "Enabling motor drivers");
    gpio_set_level(POWER_GPIO_MOTOR_ENABLE, 1);
    g_power_state.motor_drivers_enabled = true;
    return ESP_OK;
}

esp_err_t power_mgmt_disable_motor_drivers(void)
{
    ESP_LOGI(TAG, "Disabling motor drivers");
    gpio_set_level(POWER_GPIO_MOTOR_ENABLE, 0);
    g_power_state.motor_drivers_enabled = false;
    return ESP_OK;
}

esp_err_t power_mgmt_get_state(power_mgmt_state_t *state)
{
    if (state == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    *state = g_power_state;
    return ESP_OK;
}

void power_mgmt_update(void)
{
    // Update uptime
    uint32_t current_time_ms = xTaskGetTickCount() * portTICK_PERIOD_MS;
    g_power_state.uptime_ms = current_time_ms - g_init_time_ms;
    
    // Could add other periodic checks here:
    // - Temperature monitoring
    // - Voltage monitoring
    // - Automatic sleep/shutdown logic
}

void power_mgmt_emergency_shutdown(void)
{
    ESP_LOGE(TAG, "EMERGENCY SHUTDOWN INITIATED");
    
    // Shutdown in reverse order for safety
    power_mgmt_disable_motor_drivers();
    vTaskDelay(pdMS_TO_TICKS(100)); // Allow motors to coast down
    
    power_mgmt_disable_high_voltage();
    vTaskDelay(pdMS_TO_TICKS(50));  // Allow capacitors to discharge
    
    // Keep compute enabled for logging/communication
    ESP_LOGE(TAG, "Emergency shutdown complete - compute still active");
}
