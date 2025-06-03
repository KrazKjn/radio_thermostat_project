// hvac_fan.js
export const HVAC_FAN_AUTO = 0;
export const HVAC_FAN_CIRCULATE = 1;
export const HVAC_FAN_ON = 2;

export const HVAC_FAN_MODES = {
  [HVAC_FAN_AUTO]: "Auto",
  [HVAC_FAN_CIRCULATE]: "Circulate",
  [HVAC_FAN_ON]: "On",
};

export const HVAC_FAN_OPTIONS = [
  { label: HVAC_FAN_MODES[HVAC_FAN_AUTO], icon: "refresh-outline", value: HVAC_FAN_AUTO },
  { label: HVAC_FAN_MODES[HVAC_FAN_CIRCULATE], icon: "sync-outline", value: HVAC_FAN_CIRCULATE },
  { label: HVAC_FAN_MODES[HVAC_FAN_ON], icon: "power-outline", value: HVAC_FAN_ON },
];

export const HVAC_FAN_COLORS = {
  [HVAC_FAN_AUTO]: "#181c20",
  [HVAC_FAN_CIRCULATE]: "#0ff",
  [HVAC_FAN_ON]: "#0f0"
};
export const HVAC_FAN_TEXT_COLORS = {
  [HVAC_FAN_AUTO]: "#0ff",
  [HVAC_FAN_CIRCULATE]: "#222",
  [HVAC_FAN_ON]: "#fff"
};
export const HVAC_FAN_ICONS = {
  [HVAC_FAN_AUTO]: "refresh-outline",
  [HVAC_FAN_CIRCULATE]: "sync-outline",
  [HVAC_FAN_ON]: "power-outline",
};
export const HVAC_FAN_ICON_COLORS = {
  [HVAC_FAN_AUTO]: "#0ff",
  [HVAC_FAN_CIRCULATE]: "#0f0",
  [HVAC_FAN_ON]: "#f00",
};
export const HVAC_FAN_ICON_SIZES = {
  [HVAC_FAN_AUTO]: 24,
  [HVAC_FAN_CIRCULATE]: 24,
  [HVAC_FAN_ON]: 24,
};
export const HVAC_FAN_BUTTON_STYLES = {
  [HVAC_FAN_AUTO]: { backgroundColor: "#181c20", padding: 8, borderRadius: 4 },
  [HVAC_FAN_CIRCULATE]: { backgroundColor: "#0ff", padding: 8, borderRadius: 4 },
  [HVAC_FAN_ON]: { backgroundColor: "#f00", padding: 8, borderRadius: 4 },
};
export const HVAC_FAN_BUTTON_TEXT_STYLES = {
  [HVAC_FAN_AUTO]: { color: "#0ff", fontSize: 16 },
  [HVAC_FAN_CIRCULATE]: { color: "#222", fontSize: 16 },
  [HVAC_FAN_ON]: { color: "#fff", fontSize: 16 },
};
export const HVAC_FAN_BUTTON_WIDTH = 120; // Width for fan mode buttons
export const HVAC_FAN_BUTTON_HEIGHT = 40; // Height for fan mode buttons
export const HVAC_FAN_BUTTON_MARGIN = 8; // Margin between fan mode buttons
export const HVAC_FAN_BUTTON_BORDER_RADIUS = 4; // Border radius for fan mode buttons
export const HVAC_FAN_BUTTON_CONTAINER_STYLE = {
  flexDirection: "row",
  justifyContent: "space-around",
  alignItems: "center",
  marginVertical: 8,
};
export const HVAC_FAN_BUTTON_TEXT_STYLE = {
  fontSize: 16,
  fontWeight: "bold",
  textAlign: "center",
};
export const HVAC_FAN_BUTTON_ACTIVE_STYLE = {
  backgroundColor: "#0ff",
  padding: 8,
  borderRadius: 4,
};
export const HVAC_FAN_BUTTON_ACTIVE_TEXT_STYLE = {
  color: "#222",
  fontSize: 16,
};
export const HVAC_FAN_BUTTON_INACTIVE_STYLE = {
  backgroundColor: "#181c20",
  padding: 8,
  borderRadius: 4,
};
export const HVAC_FAN_BUTTON_INACTIVE_TEXT_STYLE = {
  color: "#0ff",
  fontSize: 16,
};
export const HVAC_FAN_BUTTON_ICON_STYLE = {
  marginRight: 8,
};
export const HVAC_FAN_BUTTON_ICON_CONTAINER_STYLE = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center"
};

export const HVAC_FAN_BUTTON_ICON_ACTIVE_STYLE = {
  color: "#222",
};
export const HVAC_FAN_BUTTON_ICON_INACTIVE_STYLE = {
  color: "#0ff",
};
export const HVAC_FAN_BUTTON_ICON_TEXT_STYLE = {
  color: "#0ff",
  fontWeight: "bold",
  fontSize: 16
};
export const HVAC_FAN_BUTTON_ICON_TEXT_CONTAINER_STYLE = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center"
};
export const HVAC_FAN_BUTTON_ICON_COLOR = "#0ff"; // Color for icons in scan mode buttons
export const HVAC_FAN_BUTTON_ICON_SIZE = 24; // Size for icons in fan mode buttons
export const HVAC_FAN_BUTTON_ICON_TEXT_MARGIN = 8; // Margin between icon and text in scan mode buttons
export const HVAC_FAN_BUTTON_ICON_TEXT_SIZE = 16; // Font size for text in scan mode buttons
export const HVAC_FAN_BUTTON_ICON_TEXT_COLOR = "#0ff"; // Color for text in fan mode buttons
export const HVAC_FAN_BUTTON_ICON_TEXT_FONT_WEIGHT = "bold"; // Font weight for text in scan mode buttons
