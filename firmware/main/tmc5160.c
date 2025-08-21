/**
 * @file tmc5160.c
 * @brief TMC5160 SPI Stepper Motor Driver Implementation
 */

#include "tmc5160.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>

static const char *TAG = "TMC5160";

// Global variables
static spi_device_handle_t g_spi_device = NULL;
static bool g_initialized = false;
static tmc5160_driver_config_t g_driver_configs[TMC5160_MAX_DRIVERS];
static uint32_t g_communication_errors = 0;

/**
 * @brief Calculate CRC8 for TMC communication
 */
static uint8_t tmc5160_calc_crc8(uint8_t *data, uint8_t length)
{
    uint8_t crc = 0;
    for (uint8_t i = 0; i < length; i++) {
        uint8_t current_byte = data[i];
        for (uint8_t j = 0; j < 8; j++) {
            if ((crc >> 7) ^ (current_byte & 0x01)) {
                crc = (crc << 1) ^ 0x07;
            } else {
                crc = crc << 1;
            }
            current_byte = current_byte >> 1;
        }
    }
    return crc;
}

/**
 * @brief Send SPI frame to TMC5160 chain
 * 
 * @param driver_id Target driver ID (0-3)
 * @param reg_addr Register address
 * @param data Data to write (for write operations)
 * @param is_write true for write, false for read
 * @param response Pointer to store response data
 * @return ESP_OK on success, error code on failure
 */
static esp_err_t tmc5160_spi_transfer(uint8_t driver_id, uint8_t reg_addr, uint32_t data, bool is_write, uint32_t *response)
{
    if (!g_initialized) {
        return ESP_ERR_INVALID_STATE;
    }
    
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    // TMC5160 frame format: [Sync][Slave][Reg][Data32][CRC]
    // For chained mode, we need to send frames to reach the target driver
    uint8_t frames_needed = TMC5160_MAX_DRIVERS - driver_id;
    uint8_t tx_buffer[5 * TMC5160_MAX_DRIVERS] = {0};  // 5 bytes per frame
    uint8_t rx_buffer[5 * TMC5160_MAX_DRIVERS] = {0};
    
    // Build frame for target driver
    uint8_t frame_offset = driver_id * 5;
    tx_buffer[frame_offset + 0] = 0x05;  // Sync byte
    tx_buffer[frame_offset + 1] = 0x00;  // Slave address (0 for write, will be set by driver)
    tx_buffer[frame_offset + 2] = is_write ? reg_addr : (reg_addr | 0x80);  // Register (bit 7 = read)
    tx_buffer[frame_offset + 3] = (data >> 24) & 0xFF;  // Data MSB
    tx_buffer[frame_offset + 4] = (data >> 16) & 0xFF;
    tx_buffer[frame_offset + 5] = (data >> 8) & 0xFF;
    tx_buffer[frame_offset + 6] = data & 0xFF;         // Data LSB
    
    // Calculate CRC for the frame (excluding sync)
    uint8_t crc = tmc5160_calc_crc8(&tx_buffer[frame_offset + 1], 6);
    // CRC would be added if TMC5160 required it - most configurations don't use CRC
    
    // Send dummy frames to shift data through chain to target driver
    spi_transaction_t trans = {
        .length = 8 * frames_needed * 5,  // Total bits
        .tx_buffer = tx_buffer,
        .rx_buffer = rx_buffer,
    };
    
    esp_err_t ret = spi_device_transmit(g_spi_device, &trans);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI transmission failed: %s", esp_err_to_name(ret));
        g_communication_errors++;
        return ret;
    }
    
    // Extract response from the correct position in rx_buffer
    if (response != NULL && !is_write) {
        uint8_t response_offset = driver_id * 5;
        *response = (rx_buffer[response_offset + 3] << 24) |
                   (rx_buffer[response_offset + 4] << 16) |
                   (rx_buffer[response_offset + 5] << 8) |
                   rx_buffer[response_offset + 6];
    }
    
    return ESP_OK;
}

/**
 * @brief Write register with read-after-write verification
 */
static esp_err_t tmc5160_write_register_verified(uint8_t driver_id, uint8_t reg_addr, uint32_t value)
{
    esp_err_t ret;
    
    // Write the register
    ret = tmc5160_spi_transfer(driver_id, reg_addr, value, true, NULL);
    if (ret != ESP_OK) {
        return ret;
    }
    
    // Small delay to allow register update
    vTaskDelay(pdMS_TO_TICKS(1));
    
    // Read back and verify (for writable registers)
    uint32_t readback;
    ret = tmc5160_spi_transfer(driver_id, reg_addr, 0, false, &readback);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Read-after-write verification failed for driver %d, reg 0x%02X", driver_id, reg_addr);
        return ret;
    }
    
    if (readback != value) {
        ESP_LOGW(TAG, "Read-after-write mismatch for driver %d, reg 0x%02X: wrote 0x%08lX, read 0x%08lX", 
                 driver_id, reg_addr, value, readback);
        g_communication_errors++;
        return ESP_ERR_INVALID_RESPONSE;
    }
    
    ESP_LOGD(TAG, "Driver %d reg 0x%02X verified: 0x%08lX", driver_id, reg_addr, value);
    return ESP_OK;
}

/**
 * @brief Convert current in mA to TMC5160 register value
 */
static uint8_t tmc5160_current_to_cs(uint16_t current_ma)
{
    // TMC5160 current scaling formula (assuming Rsense = 0.075 ohm, typical for SilentStepStick)
    // CS = (current_ma * 32 * Rsense) / (Vfs * 1000)
    // Where Vfs = 0.325V (typical)
    
    float rsense = 0.075f;  // 75 mOhm sense resistor
    float vfs = 0.325f;     // Full scale voltage
    
    uint8_t cs = (uint8_t)((current_ma * 32 * rsense) / (vfs * 1000.0f));
    
    // Clamp to valid range (0-31)
    if (cs > 31) cs = 31;
    
    return cs;
}

esp_err_t tmc5160_init(void)
{
    ESP_LOGI(TAG, "Initializing TMC5160 SPI driver");
    
    // Configure SPI bus
    spi_bus_config_t bus_config = {
        .miso_io_num = TMC5160_SPI_MISO_GPIO,
        .mosi_io_num = TMC5160_SPI_MOSI_GPIO,
        .sclk_io_num = TMC5160_SPI_SCLK_GPIO,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 64,
    };
    
    esp_err_t ret = spi_bus_initialize(TMC5160_SPI_HOST, &bus_config, SPI_DMA_CH_AUTO);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize SPI bus: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Configure SPI device
    spi_device_interface_config_t dev_config = {
        .clock_speed_hz = TMC5160_SPI_FREQ_HZ,
        .mode = 3,  // SPI mode 3 (CPOL=1, CPHA=1) for TMC5160
        .spics_io_num = TMC5160_SPI_CS_GPIO,
        .queue_size = 7,
        .flags = 0,
        .pre_cb = NULL,
        .post_cb = NULL,
    };
    
    ret = spi_bus_add_device(TMC5160_SPI_HOST, &dev_config, &g_spi_device);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add SPI device: %s", esp_err_to_name(ret));
        spi_bus_free(TMC5160_SPI_HOST);
        return ret;
    }
    
    // Allow SPI to stabilize
    vTaskDelay(pdMS_TO_TICKS(100));
    
    // Initialize default configurations for all drivers
    for (int i = 0; i < TMC5160_MAX_DRIVERS; i++) {
        g_driver_configs[i] = (tmc5160_driver_config_t) {
            .driver_id = i,
            .microsteps = 16,               // 16 microsteps
            .run_current_ma = 1000,         // 1A run current
            .hold_current_ma = 500,         // 0.5A hold current  
            .max_velocity = 200000,         // 200k steps/s max velocity
            .max_acceleration = 10000,      // 10k steps/s² acceleration
            .stealthchop_enabled = true,    // Enable quiet operation
            .coolstep_enabled = true,       // Enable current regulation
            .stallguard_enabled = false,    // Disable stall detection initially
        };
        
        ret = tmc5160_configure_driver(&g_driver_configs[i]);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Failed to configure driver %d: %s", i, esp_err_to_name(ret));
            return ret;
        }
    }
    
    // Verify communication with all drivers
    uint8_t drivers_detected;
    ret = tmc5160_check_communication(&drivers_detected);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Communication check failed, but continuing...");
    } else {
        ESP_LOGI(TAG, "Detected %d TMC5160 drivers", drivers_detected);
    }
    
    g_initialized = true;
    ESP_LOGI(TAG, "TMC5160 driver initialized successfully");
    return ESP_OK;
}

esp_err_t tmc5160_configure_driver(const tmc5160_driver_config_t *config)
{
    if (config == NULL || config->driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint8_t driver_id = config->driver_id;
    esp_err_t ret;
    
    ESP_LOGI(TAG, "Configuring driver %d", driver_id);
    
    // Store configuration
    g_driver_configs[driver_id] = *config;
    
    // 1. Configure GCONF (Global Configuration)
    uint32_t gconf = 0;
    gconf |= (1 << 4);  // en_pwm_mode (Enable StealthChop)
    if (config->stealthchop_enabled) {
        gconf |= (1 << 2);  // stealthchop
    }
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_GCONF, gconf);
    if (ret != ESP_OK) return ret;
    
    // 2. Configure CHOPCONF (Chopper Configuration)
    uint32_t chopconf = 0x10000053;  // Default values for NEMA17
    // Set microstep resolution
    uint8_t mres = 8;  // Default to 16 microsteps (2^(8-mres))
    switch (config->microsteps) {
        case 256: mres = 0; break;
        case 128: mres = 1; break;
        case 64:  mres = 2; break;
        case 32:  mres = 3; break;
        case 16:  mres = 4; break;
        case 8:   mres = 5; break;
        case 4:   mres = 6; break;
        case 2:   mres = 7; break;
        case 1:   mres = 8; break;
        default:  mres = 4; break;  // 16 microsteps
    }
    chopconf |= (mres << 24);
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_CHOPCONF, chopconf);
    if (ret != ESP_OK) return ret;
    
    // 3. Configure current scaling
    ret = tmc5160_set_current(driver_id, config->run_current_ma, config->hold_current_ma);
    if (ret != ESP_OK) return ret;
    
    // 4. Configure ramp parameters
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_VSTART, 1);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_A1, config->max_acceleration / 2);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_V1, config->max_velocity / 4);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_AMAX, config->max_acceleration);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_VMAX, config->max_velocity);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_DMAX, config->max_acceleration);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_D1, config->max_acceleration / 2);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_VSTOP, 10);
    if (ret != ESP_OK) return ret;
    
    // 5. Configure CoolStep if enabled
    if (config->coolstep_enabled) {
        uint32_t coolconf = 0;
        coolconf |= (2 << 0);   // semin = 2
        coolconf |= (0 << 5);   // seup = 0
        coolconf |= (2 << 8);   // semax = 2
        coolconf |= (1 << 13);  // sedn = 1
        ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_COOLCONF, coolconf);
        if (ret != ESP_OK) return ret;
        
        // Set CoolStep threshold
        ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_TCOOLTHRS, 500);
        if (ret != ESP_OK) return ret;
    }
    
    // 6. Configure PWM for StealthChop
    if (config->stealthchop_enabled) {
        uint32_t pwmconf = 0xC10D0024;  // Default StealthChop PWM configuration
        ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_PWMCONF, pwmconf);
        if (ret != ESP_OK) return ret;
        
        // Set StealthChop threshold
        ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_TPWMTHRS, 500);
        if (ret != ESP_OK) return ret;
    }
    
    // 7. Set ramp mode to position control
    ret = tmc5160_set_ramp_mode(driver_id, TMC5160_RAMP_MODE_POSITION);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGI(TAG, "Driver %d configured successfully", driver_id);
    return ESP_OK;
}

esp_err_t tmc5160_set_target_position(uint8_t driver_id, int32_t position)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret = tmc5160_set_ramp_mode(driver_id, TMC5160_RAMP_MODE_POSITION);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_XTARGET, position);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGD(TAG, "Driver %d target position set to %ld", driver_id, position);
    return ESP_OK;
}

esp_err_t tmc5160_set_target_velocity(uint8_t driver_id, int32_t velocity)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret = tmc5160_set_ramp_mode(driver_id, TMC5160_RAMP_MODE_VELOCITY);
    if (ret != ESP_OK) return ret;
    
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_VMAX, abs(velocity));
    if (ret != ESP_OK) return ret;
    
    // Set direction by modifying ramp mode
    uint32_t ramp_mode = (velocity >= 0) ? TMC5160_RAMP_MODE_VELOCITY : (TMC5160_RAMP_MODE_VELOCITY | 0x02);
    ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_RAMPMODE, ramp_mode);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGD(TAG, "Driver %d target velocity set to %ld", driver_id, velocity);
    return ESP_OK;
}

esp_err_t tmc5160_stop_motor(uint8_t driver_id)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    return tmc5160_set_ramp_mode(driver_id, TMC5160_RAMP_MODE_HOLD);
}

esp_err_t tmc5160_get_current_position(uint8_t driver_id, int32_t *position)
{
    if (driver_id >= TMC5160_MAX_DRIVERS || position == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint32_t pos_raw;
    esp_err_t ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_XACTUAL, 0, false, &pos_raw);
    if (ret != ESP_OK) return ret;
    
    *position = (int32_t)pos_raw;
    return ESP_OK;
}

esp_err_t tmc5160_get_current_velocity(uint8_t driver_id, int32_t *velocity)
{
    if (driver_id >= TMC5160_MAX_DRIVERS || velocity == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint32_t vel_raw;
    esp_err_t ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_VACTUAL, 0, false, &vel_raw);
    if (ret != ESP_OK) return ret;
    
    *velocity = (int32_t)vel_raw;
    return ESP_OK;
}

esp_err_t tmc5160_read_status_all(tmc5160_status_t *status)
{
    if (status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memset(status, 0, sizeof(tmc5160_status_t));
    status->communication_errors = g_communication_errors;
    status->last_update_ms = xTaskGetTickCount() * portTICK_PERIOD_MS;
    
    // Read status from each driver
    for (uint8_t i = 0; i < TMC5160_MAX_DRIVERS; i++) {
        esp_err_t ret = tmc5160_read_driver_status(i, &status->driver_status[i]);
        if (ret == ESP_OK) {
            status->drivers_active++;
        }
    }
    
    return ESP_OK;
}

esp_err_t tmc5160_read_driver_status(uint8_t driver_id, tmc5160_driver_status_t *status)
{
    if (driver_id >= TMC5160_MAX_DRIVERS || status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint32_t drv_status;
    esp_err_t ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_DRV_STATUS, 0, false, &drv_status);
    if (ret != ESP_OK) return ret;
    
    // Parse DRV_STATUS register
    status->stst = (drv_status >> 31) & 1;
    status->olb = (drv_status >> 30) & 1;
    status->ola = (drv_status >> 29) & 1;
    status->s2gb = (drv_status >> 28) & 1;
    status->s2ga = (drv_status >> 27) & 1;
    status->otpw = (drv_status >> 26) & 1;
    status->ot = (drv_status >> 25) & 1;
    status->stallguard = (drv_status >> 24) & 1;
    status->cs_actual = (drv_status >> 16) & 0x1F;
    status->stallguard_result = drv_status & 0x3FF;
    
    // Calculate error flags
    status->error_flags = 0;
    if (status->ot) status->error_flags |= 0x01;
    if (status->otpw) status->error_flags |= 0x02;
    if (status->s2ga || status->s2gb) status->error_flags |= 0x04;
    if (status->ola || status->olb) status->error_flags |= 0x08;
    
    return ESP_OK;
}

esp_err_t tmc5160_set_ramp_mode(uint8_t driver_id, tmc5160_ramp_mode_t mode)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    return tmc5160_write_register_verified(driver_id, TMC5160_REG_RAMPMODE, mode);
}

esp_err_t tmc5160_set_current(uint8_t driver_id, uint16_t run_current_ma, uint16_t hold_current_ma)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint8_t irun = tmc5160_current_to_cs(run_current_ma);
    uint8_t ihold = tmc5160_current_to_cs(hold_current_ma);
    uint8_t iholddelay = 10;  // Hold delay
    
    uint32_t ihold_irun = (iholddelay << 16) | (irun << 8) | ihold;
    
    esp_err_t ret = tmc5160_write_register_verified(driver_id, TMC5160_REG_IHOLD_IRUN, ihold_irun);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGD(TAG, "Driver %d current set: run=%dmA (CS=%d), hold=%dmA (CS=%d)", 
             driver_id, run_current_ma, irun, hold_current_ma, ihold);
    
    return ESP_OK;
}

esp_err_t tmc5160_enable_driver(uint8_t driver_id, bool enable)
{
    if (driver_id >= TMC5160_MAX_DRIVERS) {
        return ESP_ERR_INVALID_ARG;
    }
    
    // TMC5160 is enabled/disabled via the enable pin, which is controlled by power management
    // This function could be used to set current to 0 for software disable
    if (!enable) {
        return tmc5160_set_current(driver_id, 0, 0);
    } else {
        return tmc5160_set_current(driver_id, 
                                   g_driver_configs[driver_id].run_current_ma,
                                   g_driver_configs[driver_id].hold_current_ma);
    }
}

esp_err_t tmc5160_emergency_stop(void)
{
    ESP_LOGW(TAG, "Emergency stop initiated");
    
    esp_err_t ret = ESP_OK;
    
    // Stop all motors immediately
    for (uint8_t i = 0; i < TMC5160_MAX_DRIVERS; i++) {
        esp_err_t stop_ret = tmc5160_stop_motor(i);
        if (stop_ret != ESP_OK) {
            ret = stop_ret;
        }
    }
    
    return ret;
}

esp_err_t tmc5160_reset_all(void)
{
    ESP_LOGI(TAG, "Resetting all TMC5160 drivers");
    
    // Reinitialize all drivers with default configuration
    esp_err_t ret = ESP_OK;
    for (uint8_t i = 0; i < TMC5160_MAX_DRIVERS; i++) {
        esp_err_t config_ret = tmc5160_configure_driver(&g_driver_configs[i]);
        if (config_ret != ESP_OK) {
            ret = config_ret;
        }
    }
    
    return ret;
}

esp_err_t tmc5160_check_communication(uint8_t *drivers_detected)
{
    if (drivers_detected == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    *drivers_detected = 0;
    
    for (uint8_t i = 0; i < TMC5160_MAX_DRIVERS; i++) {
        uint32_t gconf;
        esp_err_t ret = tmc5160_spi_transfer(i, TMC5160_REG_GCONF, 0, false, &gconf);
        if (ret == ESP_OK) {
            (*drivers_detected)++;
            ESP_LOGD(TAG, "Driver %d responding, GCONF=0x%08lX", i, gconf);
        } else {
            ESP_LOGW(TAG, "Driver %d not responding", i);
        }
    }
    
    if (*drivers_detected == 0) {
        ESP_LOGE(TAG, "No TMC5160 drivers detected");
        return ESP_ERR_NOT_FOUND;
    }
    
    return ESP_OK;
}

esp_err_t tmc5160_get_motion_params(uint8_t driver_id, tmc5160_motion_params_t *params)
{
    if (driver_id >= TMC5160_MAX_DRIVERS || params == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret;
    uint32_t reg_val;
    
    // Read current position
    ret = tmc5160_get_current_position(driver_id, &params->current_position);
    if (ret != ESP_OK) return ret;
    
    // Read current velocity  
    ret = tmc5160_get_current_velocity(driver_id, &params->current_velocity);
    if (ret != ESP_OK) return ret;
    
    // Read target position
    ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_XTARGET, 0, false, &reg_val);
    if (ret != ESP_OK) return ret;
    params->target_position = (int32_t)reg_val;
    
    // Read ramp parameters
    ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_AMAX, 0, false, &reg_val);
    if (ret != ESP_OK) return ret;
    params->acceleration = reg_val;
    
    ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_VMAX, 0, false, &reg_val);
    if (ret != ESP_OK) return ret;
    params->max_velocity = reg_val;
    
    // Read ramp mode
    ret = tmc5160_spi_transfer(driver_id, TMC5160_REG_RAMPMODE, 0, false, &reg_val);
    if (ret != ESP_OK) return ret;
    params->ramp_mode = (tmc5160_ramp_mode_t)(reg_val & 0x03);
    
    // Check if motion is complete (position mode only)
    if (params->ramp_mode == TMC5160_RAMP_MODE_POSITION) {
        params->motion_complete = (abs(params->target_position - params->current_position) < 5);
    } else {
        params->motion_complete = false;
    }
    
    return ESP_OK;
}
