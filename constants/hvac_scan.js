// hvac_scan.js
const HVAC_SCAN_DISABLED = 0;
const HVAC_SCAN_DEMAND = 1;
const HVAC_SCAN_CLOUD = 2;

const HVAC_SCAN_MODES = {
  [HVAC_SCAN_DISABLED]: "Disabled",
  [HVAC_SCAN_DEMAND]: "Demand Scan",
  [HVAC_SCAN_CLOUD]: "Cloud Scan"
};

const HVAC_SCAN_MODE_OPTIONS = [
  { label: HVAC_SCAN_MODES[HVAC_SCAN_DISABLED], icon: "power-outline", value: HVAC_SCAN_DISABLED },
  { label: HVAC_SCAN_MODES[HVAC_SCAN_DEMAND], icon: "search-outline", value: HVAC_SCAN_DEMAND },
  { label: HVAC_SCAN_MODES[HVAC_SCAN_CLOUD], icon: "cloud-outline", value: HVAC_SCAN_CLOUD }
];

const HVAC_SCAN_MODE_COLORS = {
  [HVAC_SCAN_DISABLED]: "#181c20",
  [HVAC_SCAN_DEMAND]: "#0ff",
  [HVAC_SCAN_CLOUD]: "#0f0"
};
const HVAC_SCAN_MODE_TEXT_COLORS = {
  [HVAC_SCAN_DISABLED]: "#0ff",
  [HVAC_SCAN_DEMAND]: "#222",
  [HVAC_SCAN_CLOUD]: "#222"
};
const HVAC_SCAN_MODE_ICONS = {
  [HVAC_SCAN_DISABLED]: "power-outline",
  [HVAC_SCAN_DEMAND]: "search-outline",
  [HVAC_SCAN_CLOUD]: "cloud-outline"
};
const HVAC_SCAN_MODE_ICON_COLORS = {
  [HVAC_SCAN_DISABLED]: "#0ff",
  [HVAC_SCAN_DEMAND]: "#222",
  [HVAC_SCAN_CLOUD]: "#222"
};
const HVAC_SCAN_MODE_ICON_SIZES = {
  [HVAC_SCAN_DISABLED]: 24,
  [HVAC_SCAN_DEMAND]: 24,
  [HVAC_SCAN_CLOUD]: 24
};
const HVAC_SCAN_MODE_BUTTON_STYLES = {
  [HVAC_SCAN_DISABLED]: { backgroundColor: "#181c20", padding: 8, borderRadius: 4 },
  [HVAC_SCAN_DEMAND]: { backgroundColor: "#0ff", padding: 8, borderRadius: 4 },
  [HVAC_SCAN_CLOUD]: { backgroundColor: "#0f0", padding: 8, borderRadius: 4 }
};
const HVAC_SCAN_MODE_BUTTON_TEXT_STYLES = {
  [HVAC_SCAN_DISABLED]: { color: "#0ff", fontSize: 16 },
  [HVAC_SCAN_DEMAND]: { color: "#222", fontSize: 16 },
  [HVAC_SCAN_CLOUD]: { color: "#222", fontSize: 16 }
};
const HVAC_SCAN_MODE_BUTTON_WIDTH = 120; // Width for scan mode buttons
const HVAC_SCAN_MODE_BUTTON_HEIGHT = 40; // Height for scan mode buttons
const HVAC_SCAN_MODE_BUTTON_MARGIN = 8; // Margin between scan mode buttons
const HVAC_SCAN_MODE_BUTTON_BORDER_RADIUS = 4; // Border radius for scan mode buttons
const HVAC_SCAN_MODE_BUTTON_CONTAINER_STYLE = {
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
  marginVertical: 16
};
const HVAC_SCAN_MODE_BUTTON_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: "bold",
  textAlign: "center",
};
const HVAC_SCAN_MODE_BUTTON_ACTIVE_STYLE = {
  backgroundColor: "#0ff",
  padding: 8,
  borderRadius: 4,
};
const HVAC_SCAN_MODE_BUTTON_ACTIVE_TEXT_STYLE = {
  color: "#222",
  fontSize: 16,
};
const HVAC_SCAN_MODE_BUTTON_INACTIVE_STYLE = {
  backgroundColor: "#181c20",
  padding: 8,
  borderRadius: 4,
};
const HVAC_SCAN_MODE_BUTTON_INACTIVE_TEXT_STYLE = {
  color: "#0ff",
  fontSize: 16,
};
const HVAC_SCAN_MODE_BUTTON_ICON_STYLE = {
  marginRight: 8,
};
const HVAC_SCAN_MODE_BUTTON_ICON_CONTAINER_STYLE = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center"
};

const HVAC_SCAN_MODE_BUTTON_ICON_ACTIVE_STYLE = {
  color: "#222",
};
const HVAC_SCAN_MODE_BUTTON_ICON_INACTIVE_STYLE = {
  color: "#0ff",
};
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_STYLE = {
  color: "#0ff",
  fontWeight: "bold",
  fontSize: 16
};
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_CONTAINER_STYLE = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center"
};
const HVAC_SCAN_MODE_BUTTON_ICON_COLOR = "#0ff"; // Color for icons in scan mode buttons
const HVAC_SCAN_MODE_BUTTON_ICON_SIZE = 24; // Size for icons in scan mode buttons
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_MARGIN = 8; // Margin between icon and text in scan mode buttons
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_SIZE = 16; // Font size for text in scan mode buttons
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_COLOR = "#0ff"; // Color for text in scan mode buttons
const HVAC_SCAN_MODE_BUTTON_ICON_TEXT_FONT_WEIGHT = "bold"; // Font weight for text in scan mode buttons

// Export all constants using CommonJS
module.exports = {
  HVAC_SCAN_DISABLED,
  HVAC_SCAN_DEMAND,
  HVAC_SCAN_CLOUD,
  HVAC_SCAN_MODE_OPTIONS,
  HVAC_SCAN_MODES,
  HVAC_SCAN_MODE_COLORS,
  HVAC_SCAN_MODE_TEXT_COLORS,
  HVAC_SCAN_MODE_ICONS,
  HVAC_SCAN_MODE_ICON_COLORS,
  HVAC_SCAN_MODE_ICON_SIZES,
  HVAC_SCAN_MODE_BUTTON_STYLES,
  HVAC_SCAN_MODE_BUTTON_TEXT_STYLES,
  HVAC_SCAN_MODE_BUTTON_WIDTH,
  HVAC_SCAN_MODE_BUTTON_HEIGHT,
  HVAC_SCAN_MODE_BUTTON_MARGIN,
  HVAC_SCAN_MODE_BUTTON_BORDER_RADIUS,
  HVAC_SCAN_MODE_BUTTON_CONTAINER_STYLE,
  HVAC_SCAN_MODE_BUTTON_TEXT_STYLE,
  HVAC_SCAN_MODE_BUTTON_ACTIVE_STYLE,
  HVAC_SCAN_MODE_BUTTON_ACTIVE_TEXT_STYLE,
  HVAC_SCAN_MODE_BUTTON_INACTIVE_STYLE,
  HVAC_SCAN_MODE_BUTTON_INACTIVE_TEXT_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_CONTAINER_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_ACTIVE_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_INACTIVE_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_CONTAINER_STYLE,
  HVAC_SCAN_MODE_BUTTON_ICON_COLOR,
  HVAC_SCAN_MODE_BUTTON_ICON_SIZE,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_MARGIN,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_SIZE,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_COLOR,
  HVAC_SCAN_MODE_BUTTON_ICON_TEXT_FONT_WEIGHT
};