/**
 * @file ina228.h
 * @brief INA228 I2C Power Monitor Driver
 * 
 * Driver for Texas Instruments INA228 High-Side or Low-Side Measurement,
 * Bi-Directional Current and Power Monitor with I2C interface.
 * 
 * Features:
 * - 85V max input voltage
 * - 20-bit ADC resolution  
 * - Programmable gain amplifier
 * - Built-in calibration
 */

#ifndef INA228_H
#define INA228_H

#include "esp_err.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

// I2C Configuration
#define INA228_I2C_ADDR_DEFAULT    0x40    ///< Default I2C address (A1=A0=GND)
#define INA228_I2C_SDA_GPIO        6       ///< I2C SDA GPIO pin
#define INA228_I2C_SCL_GPIO        7       ///< I2C SCL GPIO pin
#define INA228_I2C_FREQ_HZ         400000  ///< I2C frequency (400kHz)

// Register Addresses
#define INA228_REG_CONFIG          0x00    ///< Configuration register
#define INA228_REG_ADC_CONFIG      0x01    ///< ADC configuration register
#define INA228_REG_SHUNT_CAL       0x02    ///< Shunt calibration register
#define INA228_REG_SHUNT_TEMPCO    0x03    ///< Shunt temperature coefficient
#define INA228_REG_VSHUNT          0x04    ///< Shunt voltage measurement
#define INA228_REG_VBUS            0x05    ///< Bus voltage measurement
#define INA228_REG_DIETEMP         0x06    ///< Die temperature measurement
#define INA228_REG_CURRENT         0x07    ///< Current measurement
#define INA228_REG_POWER           0x08    ///< Power measurement
#define INA228_REG_ENERGY          0x09    ///< Energy measurement
#define INA228_REG_CHARGE          0x0A    ///< Charge measurement
#define INA228_REG_DIAG_ALRT       0x0B    ///< Diagnostic flags and alert
#define INA228_REG_SOVL            0x0C    ///< Shunt overvoltage threshold
#define INA228_REG_SUVL            0x0D    ///< Shunt undervoltage threshold
#define INA228_REG_BOVL            0x0E    ///< Bus overvoltage threshold
#define INA228_REG_BUVL            0x0F    ///< Bus undervoltage threshold
#define INA228_REG_TEMP_LIMIT      0x10    ///< Temperature over-limit threshold
#define INA228_REG_PWR_LIMIT       0x11    ///< Power over-limit threshold
#define INA228_REG_MANUFACTURER_ID 0x3E    ///< Manufacturer ID
#define INA228_REG_DEVICE_ID       0x3F    ///< Device ID

// Configuration Register Bits
#define INA228_CONFIG_RST          (1 << 15) ///< Reset bit
#define INA228_CONFIG_CONVDLY_SHIFT 6        ///< Conversion delay shift
#define INA228_CONFIG_TEMPCOMP     (1 << 5)  ///< Temperature compensation enable
#define INA228_CONFIG_ADCRANGE     (1 << 4)  ///< ADC range (0: ±163.84 mV, 1: ±40.96 mV)

// ADC Configuration Register
#define INA228_ADC_CONFIG_MODE_SHIFT     12  ///< Operating mode shift
#define INA228_ADC_CONFIG_VBUSCT_SHIFT   9   ///< Bus voltage conversion time shift  
#define INA228_ADC_CONFIG_VSHCT_SHIFT    6   ///< Shunt voltage conversion time shift
#define INA228_ADC_CONFIG_VTCT_SHIFT     3   ///< Temperature conversion time shift
#define INA228_ADC_CONFIG_AVG_SHIFT      0   ///< Averaging count shift

// Operating Modes
typedef enum {
    INA228_MODE_SHUTDOWN = 0x0,           ///< Shutdown
    INA228_MODE_TRIG_BUS = 0x1,          ///< Triggered bus voltage
    INA228_MODE_TRIG_SHUNT = 0x2,        ///< Triggered shunt voltage  
    INA228_MODE_TRIG_BUS_SHUNT = 0x3,    ///< Triggered bus and shunt voltage
    INA228_MODE_TRIG_TEMP = 0x4,         ///< Triggered temperature
    INA228_MODE_TRIG_BUS_TEMP = 0x5,     ///< Triggered bus voltage and temperature
    INA228_MODE_TRIG_SHUNT_TEMP = 0x6,   ///< Triggered shunt voltage and temperature
    INA228_MODE_TRIG_ALL = 0x7,          ///< Triggered all measurements
    INA228_MODE_CONT_BUS = 0x9,          ///< Continuous bus voltage
    INA228_MODE_CONT_SHUNT = 0xA,        ///< Continuous shunt voltage
    INA228_MODE_CONT_BUS_SHUNT = 0xB,    ///< Continuous bus and shunt voltage
    INA228_MODE_CONT_TEMP = 0xC,         ///< Continuous temperature  
    INA228_MODE_CONT_BUS_TEMP = 0xD,     ///< Continuous bus voltage and temperature
    INA228_MODE_CONT_SHUNT_TEMP = 0xE,   ///< Continuous shunt voltage and temperature
    INA228_MODE_CONT_ALL = 0xF           ///< Continuous all measurements
} ina228_mode_t;

// Conversion Times (based on datasheet values)
typedef enum {
    INA228_CT_50US = 0,     ///< 50 μs
    INA228_CT_84US = 1,     ///< 84 μs  
    INA228_CT_150US = 2,    ///< 150 μs
    INA228_CT_280US = 3,    ///< 280 μs
    INA228_CT_540US = 4,    ///< 540 μs
    INA228_CT_1052US = 5,   ///< 1.052 ms
    INA228_CT_2074US = 6,   ///< 2.074 ms
    INA228_CT_4120US = 7    ///< 4.120 ms
} ina228_conversion_time_t;

// Averaging Counts
typedef enum {
    INA228_AVG_1 = 0,      ///< 1 sample (no averaging)
    INA228_AVG_4 = 1,      ///< 4 samples
    INA228_AVG_16 = 2,     ///< 16 samples  
    INA228_AVG_64 = 3,     ///< 64 samples
    INA228_AVG_128 = 4,    ///< 128 samples
    INA228_AVG_256 = 5,    ///< 256 samples
    INA228_AVG_512 = 6,    ///< 512 samples
    INA228_AVG_1024 = 7    ///< 1024 samples
} ina228_averaging_t;

// Configuration structure
typedef struct {
    ina228_mode_t mode;                           ///< Operating mode
    ina228_conversion_time_t vbus_ct;            ///< Bus voltage conversion time
    ina228_conversion_time_t vshunt_ct;          ///< Shunt voltage conversion time  
    ina228_conversion_time_t temp_ct;            ///< Temperature conversion time
    ina228_averaging_t averaging;                 ///< Averaging count
    bool adc_range_high;                         ///< ADC range (false: ±163.84mV, true: ±40.96mV)
    bool temp_comp_enable;                       ///< Temperature compensation enable
    float shunt_resistor_ohms;                   ///< Shunt resistor value in ohms
    float max_expected_current_a;                ///< Maximum expected current in amperes
} ina228_config_t;

// Measurement data structure
typedef struct {
    float bus_voltage_v;      ///< Bus voltage in volts
    float shunt_voltage_mv;   ///< Shunt voltage in millivolts
    float current_a;          ///< Current in amperes
    float power_w;            ///< Power in watts
    float die_temperature_c;  ///< Die temperature in Celsius
    bool data_ready;          ///< Data ready flag
} ina228_measurements_t;

/**
 * @brief Initialize INA228 driver
 * 
 * Initializes I2C bus and configures INA228 with default settings:
 * - Continuous bus, shunt, and temperature measurement
 * - 1.052ms conversion time for good accuracy vs speed tradeoff
 * - 16-sample averaging for noise reduction
 * - Temperature compensation enabled
 * 
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_init(void);

/**
 * @brief Configure INA228 with custom settings
 * 
 * @param config Pointer to configuration structure
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_configure(const ina228_config_t *config);

/**
 * @brief Read all measurements from INA228
 * 
 * @param voltage Pointer to store bus voltage (volts)
 * @param current Pointer to store current (amperes) 
 * @param power Pointer to store power (watts)
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_read_measurements(float *voltage, float *current, float *power);

/**
 * @brief Read detailed measurements from INA228
 * 
 * @param measurements Pointer to store all measurement data
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_read_measurements_detailed(ina228_measurements_t *measurements);

/**
 * @brief Read bus voltage only
 * 
 * @param voltage Pointer to store voltage in volts
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_read_bus_voltage(float *voltage);

/**
 * @brief Read current only
 * 
 * @param current Pointer to store current in amperes
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_read_current(float *current);

/**
 * @brief Read die temperature
 * 
 * @param temperature Pointer to store temperature in Celsius
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_read_temperature(float *temperature);

/**
 * @brief Reset INA228 to default settings
 * 
 * @return ESP_OK on success, error code on failure
 */
esp_err_t ina228_reset(void);

/**
 * @brief Check if INA228 is present and responding
 * 
 * @return ESP_OK if device is present, error code otherwise
 */
esp_err_t ina228_check_device(void);

/**
 * @brief Get the total conversion time for current configuration
 * 
 * This helps determine appropriate task timing
 * 
 * @return Total conversion time in milliseconds
 */
uint32_t ina228_get_conversion_time_ms(void);

#ifdef __cplusplus
}
#endif

#endif // INA228_H
