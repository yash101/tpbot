/**
 * @file ina228.c
 * @brief INA228 I2C Power Monitor Driver Implementation
 */

#include "ina228.h"
#include "driver/i2c.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <math.h>

static const char *TAG = "INA228";

// I2C port number
#define I2C_MASTER_NUM              0

// Device constants
#define INA228_MANUFACTURER_ID      0x5449  // "TI" in ASCII
#define INA228_DEVICE_ID            0x228   // Device ID

// Current and power LSB calculation constants
#define INA228_CURRENT_LSB_SCALE    (1.0f / 524288.0f)  // 2^19, 20-bit signed
#define INA228_POWER_LSB_MULTIPLIER 3.2f

// Global variables
static bool g_initialized = false;
static ina228_config_t g_config;
static float g_current_lsb = 0.0f;
static float g_power_lsb = 0.0f;

/**
 * @brief Write 16-bit register to INA228
 */
static esp_err_t ina228_write_register(uint8_t reg_addr, uint16_t value)
{
    uint8_t data[3] = {reg_addr, (value >> 8) & 0xFF, value & 0xFF};
    
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (INA228_I2C_ADDR_DEFAULT << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write(cmd, data, 3, true);
    i2c_master_stop(cmd);
    
    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write register 0x%02X: %s", reg_addr, esp_err_to_name(ret));
    }
    
    return ret;
}

/**
 * @brief Read 16-bit register from INA228
 */
static esp_err_t ina228_read_register(uint8_t reg_addr, uint16_t *value)
{
    esp_err_t ret;
    
    // Write register address
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (INA228_I2C_ADDR_DEFAULT << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, reg_addr, true);
    i2c_master_stop(cmd);
    
    ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to write register address 0x%02X: %s", reg_addr, esp_err_to_name(ret));
        return ret;
    }
    
    // Read register value
    uint8_t data[2];
    cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (INA228_I2C_ADDR_DEFAULT << 1) | I2C_MASTER_READ, true);
    i2c_master_read_byte(cmd, &data[0], I2C_MASTER_ACK);
    i2c_master_read_byte(cmd, &data[1], I2C_MASTER_NACK);
    i2c_master_stop(cmd);
    
    ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read register 0x%02X: %s", reg_addr, esp_err_to_name(ret));
        return ret;
    }
    
    *value = (data[0] << 8) | data[1];
    return ESP_OK;
}

/**
 * @brief Read 24-bit register from INA228 (for current and power)
 */
static esp_err_t ina228_read_register_24bit(uint8_t reg_addr, int32_t *value)
{
    esp_err_t ret;
    
    // Write register address
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (INA228_I2C_ADDR_DEFAULT << 1) | I2C_MASTER_WRITE, true);
    i2c_master_write_byte(cmd, reg_addr, true);
    i2c_master_stop(cmd);
    
    ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);
    
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Read 3 bytes
    uint8_t data[3];
    cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (INA228_I2C_ADDR_DEFAULT << 1) | I2C_MASTER_READ, true);
    i2c_master_read_byte(cmd, &data[0], I2C_MASTER_ACK);
    i2c_master_read_byte(cmd, &data[1], I2C_MASTER_ACK);
    i2c_master_read_byte(cmd, &data[2], I2C_MASTER_NACK);
    i2c_master_stop(cmd);
    
    ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(1000));
    i2c_cmd_link_delete(cmd);
    
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Convert to signed 24-bit value
    int32_t raw = (data[0] << 16) | (data[1] << 8) | data[2];
    
    // Sign extend if negative (bit 23 set)
    if (raw & 0x800000) {
        raw |= 0xFF000000;
    }
    
    *value = raw;
    return ESP_OK;
}

/**
 * @brief Calculate and set calibration register
 */
static esp_err_t ina228_set_calibration(void)
{
    // Calculate current LSB: max_current / 2^19
    g_current_lsb = g_config.max_expected_current_a * INA228_CURRENT_LSB_SCALE;
    
    // Calculate calibration register value
    // CAL = 0.00512 / (Current_LSB * Rshunt)
    float cal_value = 0.00512f / (g_current_lsb * g_config.shunt_resistor_ohms);
    uint16_t cal_reg = (uint16_t)roundf(cal_value);
    
    // Calculate power LSB
    g_power_lsb = g_current_lsb * INA228_POWER_LSB_MULTIPLIER;
    
    ESP_LOGI(TAG, "Calibration: Current LSB=%.6f A/bit, Power LSB=%.6f W/bit, CAL=0x%04X", 
             g_current_lsb, g_power_lsb, cal_reg);
    
    return ina228_write_register(INA228_REG_SHUNT_CAL, cal_reg);
}

esp_err_t ina228_init(void)
{
    ESP_LOGI(TAG, "Initializing INA228 driver");
    
    // Configure I2C
    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = INA228_I2C_SDA_GPIO,
        .scl_io_num = INA228_I2C_SCL_GPIO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE,
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = INA228_I2C_FREQ_HZ,
    };
    
    esp_err_t ret = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure I2C: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to install I2C driver: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Small delay for I2C to stabilize
    vTaskDelay(pdMS_TO_TICKS(100));
    
    // Check if device is present
    ret = ina228_check_device();
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Set default configuration
    g_config = (ina228_config_t) {
        .mode = INA228_MODE_CONT_ALL,           // Continuous all measurements
        .vbus_ct = INA228_CT_1052US,            // 1.052ms conversion time
        .vshunt_ct = INA228_CT_1052US,          // 1.052ms conversion time
        .temp_ct = INA228_CT_1052US,            // 1.052ms conversion time
        .averaging = INA228_AVG_16,             // 16-sample averaging
        .adc_range_high = false,                // ±163.84mV range (better for higher currents)
        .temp_comp_enable = true,               // Enable temperature compensation
        .shunt_resistor_ohms = 0.001f,          // 1mΩ shunt resistor (common value)
        .max_expected_current_a = 20.0f         // 20A max current
    };
    
    ret = ina228_configure(&g_config);
    if (ret != ESP_OK) {
        return ret;
    }
    
    g_initialized = true;
    ESP_LOGI(TAG, "INA228 initialized successfully");
    return ESP_OK;
}

esp_err_t ina228_configure(const ina228_config_t *config)
{
    if (config == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    g_config = *config;
    
    // Configure CONFIG register
    uint16_t config_reg = 0;
    if (config->adc_range_high) {
        config_reg |= INA228_CONFIG_ADCRANGE;
    }
    if (config->temp_comp_enable) {
        config_reg |= INA228_CONFIG_TEMPCOMP;
    }
    
    esp_err_t ret = ina228_write_register(INA228_REG_CONFIG, config_reg);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Configure ADC_CONFIG register
    uint16_t adc_config = 0;
    adc_config |= (config->mode << INA228_ADC_CONFIG_MODE_SHIFT);
    adc_config |= (config->vbus_ct << INA228_ADC_CONFIG_VBUSCT_SHIFT);
    adc_config |= (config->vshunt_ct << INA228_ADC_CONFIG_VSHCT_SHIFT);
    adc_config |= (config->temp_ct << INA228_ADC_CONFIG_VTCT_SHIFT);
    adc_config |= (config->averaging << INA228_ADC_CONFIG_AVG_SHIFT);
    
    ret = ina228_write_register(INA228_REG_ADC_CONFIG, adc_config);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Set calibration
    ret = ina228_set_calibration();
    if (ret != ESP_OK) {
        return ret;
    }
    
    ESP_LOGI(TAG, "INA228 configured successfully");
    return ESP_OK;
}

esp_err_t ina228_read_measurements(float *voltage, float *current, float *power)
{
    if (!g_initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (voltage == NULL || current == NULL || power == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret;
    uint16_t vbus_raw;
    int32_t current_raw, power_raw;
    
    // Read bus voltage (16-bit)
    ret = ina228_read_register(INA228_REG_VBUS, &vbus_raw);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Read current (24-bit signed)
    ret = ina228_read_register_24bit(INA228_REG_CURRENT, &current_raw);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Read power (24-bit signed)
    ret = ina228_read_register_24bit(INA228_REG_POWER, &power_raw);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Convert raw values to engineering units
    *voltage = (float)vbus_raw * 0.0001953125f;  // 195.3125 μV/bit
    *current = (float)current_raw * g_current_lsb;
    *power = (float)power_raw * g_power_lsb;
    
    return ESP_OK;
}

esp_err_t ina228_read_measurements_detailed(ina228_measurements_t *measurements)
{
    if (!g_initialized || measurements == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret;
    uint16_t vbus_raw, vshunt_raw, temp_raw;
    int32_t current_raw, power_raw;
    
    // Read all registers
    ret = ina228_read_register(INA228_REG_VBUS, &vbus_raw);
    if (ret != ESP_OK) return ret;
    
    ret = ina228_read_register(INA228_REG_VSHUNT, &vshunt_raw);
    if (ret != ESP_OK) return ret;
    
    ret = ina228_read_register(INA228_REG_DIETEMP, &temp_raw);
    if (ret != ESP_OK) return ret;
    
    ret = ina228_read_register_24bit(INA228_REG_CURRENT, &current_raw);
    if (ret != ESP_OK) return ret;
    
    ret = ina228_read_register_24bit(INA228_REG_POWER, &power_raw);
    if (ret != ESP_OK) return ret;
    
    // Convert to engineering units
    measurements->bus_voltage_v = (float)vbus_raw * 0.0001953125f;  // 195.3125 μV/bit
    measurements->shunt_voltage_mv = (float)((int16_t)vshunt_raw) * 0.0003125f;  // 312.5 nV/bit -> mV
    measurements->current_a = (float)current_raw * g_current_lsb;
    measurements->power_w = (float)power_raw * g_power_lsb;
    measurements->die_temperature_c = (float)((int16_t)temp_raw) * 0.0078125f;  // 7.8125 m°C/bit
    measurements->data_ready = true;
    
    return ESP_OK;
}

esp_err_t ina228_read_bus_voltage(float *voltage)
{
    if (!g_initialized || voltage == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint16_t raw_value;
    esp_err_t ret = ina228_read_register(INA228_REG_VBUS, &raw_value);
    if (ret != ESP_OK) {
        return ret;
    }
    
    *voltage = (float)raw_value * 0.0001953125f;  // 195.3125 μV/bit
    return ESP_OK;
}

esp_err_t ina228_read_current(float *current)
{
    if (!g_initialized || current == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    int32_t raw_value;
    esp_err_t ret = ina228_read_register_24bit(INA228_REG_CURRENT, &raw_value);
    if (ret != ESP_OK) {
        return ret;
    }
    
    *current = (float)raw_value * g_current_lsb;
    return ESP_OK;
}

esp_err_t ina228_read_temperature(float *temperature)
{
    if (!g_initialized || temperature == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint16_t raw_value;
    esp_err_t ret = ina228_read_register(INA228_REG_DIETEMP, &raw_value);
    if (ret != ESP_OK) {
        return ret;
    }
    
    *temperature = (float)((int16_t)raw_value) * 0.0078125f;  // 7.8125 m°C/bit
    return ESP_OK;
}

esp_err_t ina228_reset(void)
{
    ESP_LOGI(TAG, "Resetting INA228");
    
    esp_err_t ret = ina228_write_register(INA228_REG_CONFIG, INA228_CONFIG_RST);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Wait for reset to complete
    vTaskDelay(pdMS_TO_TICKS(10));
    
    g_initialized = false;
    return ESP_OK;
}

esp_err_t ina228_check_device(void)
{
    uint16_t manufacturer_id, device_id;
    
    esp_err_t ret = ina228_read_register(INA228_REG_MANUFACTURER_ID, &manufacturer_id);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read manufacturer ID");
        return ret;
    }
    
    ret = ina228_read_register(INA228_REG_DEVICE_ID, &device_id);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to read device ID");
        return ret;
    }
    
    ESP_LOGI(TAG, "Manufacturer ID: 0x%04X, Device ID: 0x%04X", manufacturer_id, device_id);
    
    if (manufacturer_id != INA228_MANUFACTURER_ID) {
        ESP_LOGE(TAG, "Invalid manufacturer ID: expected 0x%04X, got 0x%04X", 
                 INA228_MANUFACTURER_ID, manufacturer_id);
        return ESP_ERR_NOT_FOUND;
    }
    
    if ((device_id & 0xFFF) != INA228_DEVICE_ID) {
        ESP_LOGE(TAG, "Invalid device ID: expected 0x%03X, got 0x%03X", 
                 INA228_DEVICE_ID, device_id & 0xFFF);
        return ESP_ERR_NOT_FOUND;
    }
    
    ESP_LOGI(TAG, "INA228 device detected and verified");
    return ESP_OK;
}

uint32_t ina228_get_conversion_time_ms(void)
{
    // Conversion times in microseconds
    const uint32_t ct_table[] = {50, 84, 150, 280, 540, 1052, 2074, 4120};
    
    // Get individual conversion times
    uint32_t vbus_time = ct_table[g_config.vbus_ct];
    uint32_t vshunt_time = ct_table[g_config.vshunt_ct]; 
    uint32_t temp_time = ct_table[g_config.temp_ct];
    
    // Get averaging multiplier
    const uint32_t avg_table[] = {1, 4, 16, 64, 128, 256, 512, 1024};
    uint32_t avg_count = avg_table[g_config.averaging];
    
    // Calculate total time based on mode
    uint32_t total_time_us = 0;
    
    switch (g_config.mode) {
        case INA228_MODE_CONT_ALL:
            total_time_us = (vbus_time + vshunt_time + temp_time) * avg_count;
            break;
        case INA228_MODE_CONT_BUS_SHUNT:
            total_time_us = (vbus_time + vshunt_time) * avg_count;
            break;
        case INA228_MODE_CONT_BUS:
            total_time_us = vbus_time * avg_count;
            break;
        case INA228_MODE_CONT_SHUNT:
            total_time_us = vshunt_time * avg_count;
            break;
        case INA228_MODE_CONT_TEMP:
            total_time_us = temp_time * avg_count;
            break;
        default:
            total_time_us = 4120 * avg_count;  // Worst case
            break;
    }
    
    // Convert to milliseconds and add some margin
    return (total_time_us / 1000) + 10;
}
