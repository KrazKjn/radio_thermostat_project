const costPerKwH = parseFloat(process.env.DEFAULT_ELECTRICITY_COST_PER_KWH) || 0.126;
const costPerGallon = parseFloat(process.env.DEFAULT_PROPANE_COST_PER_GALLON) || 2.85;
const hvacUsageDecimals = parseInt(process.env.HVAC_USAGE_DECIMALS) || 2;
const hvacCostDecimals = parseInt(process.env.HVAC_COST_DECIMALS) || 2;
const fanUsageDecimals = parseInt(process.env.FAN_USAGE_DECIMALS) || 3;
const fanCostDecimals = parseInt(process.env.FAN_COST_DECIMALS) || 3;

const parseVoltage = (voltageStr) => {
    if (!voltageStr) return 230;
    if (voltageStr.includes('/')) {
        const parts = voltageStr.split('/').map(v => parseFloat(v));
        return Math.max(...parts);
    }
    return parseFloat(voltageStr);
};

const calculateKwHDraw = (rla, voltage) =>
    rla ? (rla * voltage) / 1000 : 3.5;

const calculateKwHsUsed = (runtimeMin, hvac_system) => {
  const voltage = parseVoltage(hvac_system?.voltage ?? hvac_system?.compressor_voltage);
  const kwDraw = calculateKwHDraw(hvac_system?.rla, voltage);
  return (runtimeMin / 60) * kwDraw;
};

const calculateCoolingCost = (runtimeMin, hvac_system, cost_per_unit) => {
  const kwHsUsed = calculateKwHsUsed(runtimeMin, hvac_system);
  return kwHsUsed * cost_per_unit;
};

const calculateGallonsConsumed = (runtimeMin, hvac_system, efficiency = 0.90) => {
  const heatingBTU =
    hvac_system?.btu_per_hr_high ||
    hvac_system?.btu_per_hr_low ||
    (hvac_system?.tons * 20000);

  const effectiveBTU = heatingBTU * efficiency;
  const gallonsPerMinute = (effectiveBTU / 91452) / 60;

  return runtimeMin * gallonsPerMinute;
};

const calculateHeatingCost = (runtimeMin, hvac_system, cost_per_unit, efficiency = 0.90) => {
  const gallonsUsed = calculateGallonsConsumed(runtimeMin, hvac_system, efficiency);
  return gallonsUsed * cost_per_unit;
};

const calculateFanKwHDraw = (amps, voltage) =>
  amps && voltage ? (amps * voltage) / 1000 : 0.5;

const calculateFanKwHsUsed = (runtimeMin, hvac_system) => {
  const voltage = parseVoltage(hvac_system?.fan_voltage);
  const amps = hvac_system?.fan_rated_amps;
  const kwDraw = calculateFanKwHDraw(amps, voltage);
  return (runtimeMin / 60) * kwDraw;
};

const calculateFanCost = (runtimeMin, hvac_system, cost_per_unit) => {
  const kwHsUsed = calculateFanKwHsUsed(runtimeMin, hvac_system);
  return kwHsUsed * cost_per_unit;
};

const formatMetric = (value, unit) =>
  value != null ? `${value.toFixed(1)}${unit}` : '--';

export {
    costPerKwH,
    costPerGallon,
    hvacUsageDecimals,
    hvacCostDecimals,
    fanUsageDecimals,
    fanCostDecimals,
    parseVoltage,
    calculateKwHDraw,
    calculateKwHsUsed,
    calculateCoolingCost,
    calculateGallonsConsumed,
    calculateHeatingCost,
    calculateFanKwHDraw,
    calculateFanKwHsUsed,
    calculateFanCost,
    formatMetric
};
