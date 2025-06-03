// hvac_mode.js
export const HVAC_MODE_OFF = 0;
export const HVAC_MODE_HEAT = 1;
export const HVAC_MODE_COOL = 2;
export const HVAC_MODE_AUTO = 3;

export const HVAC_MODE_LABELS = {
  [HVAC_MODE_OFF]: "Off",
  [HVAC_MODE_HEAT]: "Heat",
  [HVAC_MODE_COOL]: "Cool",
  [HVAC_MODE_AUTO]: "Auto"
};

export const HVAC_MODE_OPTIONS = [
  { label: "Off", value: HVAC_MODE_OFF },
  { label: "Heat", value: HVAC_MODE_HEAT },
  { label: "Cool", value: HVAC_MODE_COOL },
  { label: "Auto", value: HVAC_MODE_AUTO }
];