// hvac_mode.js
const HVAC_MODE_OFF = 0;
const HVAC_MODE_HEAT = 1;
const HVAC_MODE_COOL = 2;
const HVAC_MODE_AUTO = 3;

const HVAC_MODE_LABELS = {
  [HVAC_MODE_OFF]: "Off",
  [HVAC_MODE_HEAT]: "Heat",
  [HVAC_MODE_COOL]: "Cool",
  [HVAC_MODE_AUTO]: "Auto"
};

const HVAC_MODE_OPTIONS = [
  { label: "Off", value: HVAC_MODE_OFF },
  { label: "Heat", value: HVAC_MODE_HEAT },
  { label: "Cool", value: HVAC_MODE_COOL },
  { label: "Auto", value: HVAC_MODE_AUTO }
];

// Export all constants using CommonJS
module.exports = {
  HVAC_MODE_OFF,
  HVAC_MODE_HEAT,
  HVAC_MODE_COOL,
  HVAC_MODE_AUTO,
  HVAC_MODE_LABELS,
  HVAC_MODE_OPTIONS
};