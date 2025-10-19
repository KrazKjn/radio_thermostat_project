import { StyleSheet } from "react-native";

// Add these at the top of your component file, after imports

// Refactored Styles
const colors = {
  primary: "#007BFF",
  secondary: "#28A745",
  accent: "#0ff",
  background: "#f8f9fa",
  text: "#333",
  error: "red",
  white: "#fff",
  border: "#ccc",
  dark: "#222",
  light: "#ddd",
};

const sizes = {
  borderRadius: 8,
  padding: 10,
  fontSize: 16,
  headerFontSize: 24,
  titleFontSize: 20,
};

// Base Styles
const baseContainer = {
  flex: 1,
  padding: 5,
};
const baseText = {
  fontSize: sizes.fontSize,
};
const baseButton = {
  alignItems: "center",
  justifyContent: "center",
  padding: sizes.padding,
  borderRadius: sizes.borderRadius,
};

// Table header and cell styles
export const headerStyle = {
  padding: 8,
  backgroundColor: colors.primary,
  color: colors.white,
  fontWeight: "bold",
  borderRightWidth: 1,
  borderColor: colors.white,
  textAlign: "center",
};
export const cellStyle = {
  padding: 8,
  backgroundColor: colors.background,
  color: colors.text,
  borderRightWidth: 1,
  borderColor: colors.border,
  textAlign: "center",
};

// Refactored Styles
const commonStyles = StyleSheet.create({
  // Containers
  container: { ...baseContainer, alignItems: "center" },
  containerBasic: { ...baseContainer },
  containerLeft: { ...baseContainer, alignItems: "flex-start", paddingLeft: 0 },
  containerScroll: { marginTop: 0, flex: 1 },
  containerSimple: { padding: 4 },
  containerThermostat: { ...baseContainer, padding: 0, marginBottom: 0 },

  // Headers & Titles
  headerContainer: { alignItems: "center", marginBottom: 10 },
  headerNetwork: { fontSize: 18, fontWeight: "bold", color: colors.primary },
  header: { fontSize: sizes.headerFontSize, fontWeight: "bold", marginBottom: 20, color: colors.text },
  title: { fontSize: sizes.titleFontSize, fontWeight: "bold", marginBottom: 10 },

  // Info & Labels
  infoContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  label: { ...baseText, fontWeight: "bold" },
  value: { ...baseText, color: colors.primary },
  valueText: { ...baseText, fontWeight: "bold", marginTop: 10 },

  // Inputs
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: sizes.borderRadius,
    padding: sizes.padding,
    marginBottom: 16,
    backgroundColor: colors.white,
    fontSize: sizes.fontSize,
  },
  inputSmall: { borderWidth: 1, padding: 5, width: 60, marginLeft: 10 },

  // Buttons
  buttonContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 15 },
  buttonContainerLeft: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 15 },
  buttonContainerControl: { flexDirection: "row", justifyContent: "center", marginVertical: 10 },
  button: { ...baseButton, backgroundColor: colors.light },
  buttonIncreaseDecrease: { ...baseButton, backgroundColor: colors.primary, fontWeight: "bold", width: 40, height: 40 },
  setButton: { ...baseButton, backgroundColor: colors.secondary, fontWeight: "bold", paddingVertical: 10, paddingHorizontal: 20, marginTop: 10, height: 60 },
  activeButton: { backgroundColor: colors.primary },
  saveButton: { ...baseButton, backgroundColor: colors.primary },
  usersSaveButton: { ...baseButton, backgroundColor: colors.dark },
  buttonText: { color: colors.white, fontSize: sizes.fontSize, fontWeight: "bold" },
  setButtonText: { color: colors.white, fontSize: sizes.fontSize, fontWeight: "bold" },
  saveText: { fontSize: 18, fontWeight: "bold", color: colors.white },

  // Text & Status
  text: { ...baseText, marginTop: 5, color: "#777" },
  activeText: { color: colors.white },
  errorText: { color: colors.error, fontSize: 14, marginBottom: 10 },
  status: { ...baseText, fontWeight: "bold", marginBottom: 5, color: colors.primary },
  statusRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 15 },
  statusButton: { alignItems: "center", padding: 10, borderRadius: sizes.borderRadius, backgroundColor: colors.light, flexDirection: "row", gap: 10 },
  activeStatus: { backgroundColor: colors.primary },

  // Item & Action Descriptions
  item: { ...baseText, paddingVertical: 5 },
  actionDescription: { fontSize: 14, marginBottom: 15, color: "rgb(85, 155, 85)", textAlign: "center" },

  // Tabs
  tabContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 2 },
  tab: { flex: 1, alignItems: "center", padding: 12, borderRadius: 6, backgroundColor: colors.light, marginHorizontal: 5 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { fontSize: 16, fontWeight: "bold", color: colors.text },
  activeTabText: { color: colors.white },

  // Temperature Controls
  tempContainer: { alignItems: "center", marginVertical: 10 },
  tempDisplay: { fontSize: 18, fontWeight: "bold", marginHorizontal: 10 },
  controls: { flexDirection: "row", alignItems: "center", marginBottom: 10 },

  // Misc Layout
  scrollContainer: { padding: 2 },
  infoText: { fontSize: 16, textAlign: "center", marginVertical: 10 },
  rowContainer: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  saveContainer: { alignItems: "center", marginVertical: 15 },

  // Digital styles (Thermostat UI)
  thermostatLayoutRow: {
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "center",
      width: "100%",
      minHeight: 500,
  },
  thermostatDevice: {
      alignSelf: "center",
      marginVertical: 30,
      width: "100%",
      minWidth: 340,
      minHeight: 600,
      borderWidth: 4,
      borderColor: "#444",
      borderRadius: 32,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
      backgroundColor: "#222",
      padding: 0,
      position: "relative",
      flexDirection: "row",
      overflow: "hidden",
  },
  thermostatContentRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "flex-start",
      width: "100%",
      minHeight: 500,
  },
  thermostatContentColumn: {
      flex: 1,
      padding: 0,
      backgroundColor: "transparent",
      borderTopLeftRadius: 32,
      borderBottomLeftRadius: 32,
      overflow: "hidden",
  },
  deviceInfoRow: {
      alignItems: "center",
      marginBottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      width: "100%",
  },
  deviceInfoText: {
      color: "#aaa",
      fontSize: 14,
      fontFamily: "monospace",
      marginVertical: 1,
  },

  digitalCard: {
      backgroundColor: "#222",
      borderRadius: 18,
      padding: 24,
      marginBottom: 18,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
      width: "100%",
  },
  digitalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      marginBottom: 12,
  },
  digitalRowCenter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap", // <-- enables wrapping
    marginTop: 10,
    gap: 10, // if supported, or use margin on children
    width: "100%",
  },
  digitalInput: {
    backgroundColor: "#181c20",
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: sizes.borderRadius,
    paddingVertical: sizes.padding,
    paddingHorizontal: sizes.padding,
    fontSize: sizes.fontSize,
    fontFamily: "monospace",
    marginVertical: 4,
    minWidth: 60,
  },
  digitalTime: {
      color: "#0ff",
      fontSize: 32,
      fontFamily: "monospace", // Use a digital/monospace font
      letterSpacing: 2,
      flex: 1,
      paddingLeft: 8
  },
  digitalTempRow: {
      flexDirection: "row",
      flexWrap: "wrap", // allows children to wrap to next line
      alignItems: "flex-end",
      justifyContent: "center",
      marginVertical: 4,
  },
  digitalTempBlock: {
    flexDirection: "column",
    alignItems: "center",
    marginHorizontal: 8,
    flexShrink: 1, // allows block to shrink if needed
  },
  digitalLabel: {
      color: "#aaa",
      fontSize: 16,
      marginRight: 16,
      fontFamily: "monospace",
  },
  digitalTemp: {
      color: "#0ff",
      fontSize: 56,
      fontFamily: "monospace",
      fontWeight: "bold",
      marginRight: 8,
  },
  digitalTempSeparator: {
      color: "#f55",
      fontSize: 48,
      fontFamily: "monospace",
      fontWeight: "bold",
      marginRight: 8,
      minWidth: 0, // allows shrinking if needed
  },
  digitalHumidity: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 2,
    fontWeight: "400",
  },
  digitalTarget: {
      color: "#ff0",
      fontSize: 40,
      fontFamily: "monospace",
      fontWeight: "bold",
      marginRight: 8,
  },
  digitalSlider: {
      color: "#0ff",
      fontSize: 14,
      fontFamily: "monospace",
      fontWeight: "bold",
      marginRight: 8,
  },
  digitalUnit: {
      color: "#aaa",
      fontSize: 24,
      fontFamily: "monospace",
      marginLeft: 2,
  },
  digitalState: {
      color: "#0ff",
      fontSize: 16,
      fontFamily: "monospace",
      fontWeight: "bold",
      marginRight: 8,
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      borderRadius: 5,
  },
  digitalButton: {
    backgroundColor: "#111",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  digitalActiveButton: {
    backgroundColor: "#0ff",
    borderColor: "#0ff",
  },
  digitalButtonText: {
    color: "#0ff",
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 2,
  },

  digitalActiveButtonText: {
    color: "#222",
  },

  // Menu Controls
  menuColumnPermanent: {
      width: 90,
      backgroundColor: "#222",
      borderTopRightRadius: 32,
      borderBottomRightRadius: 32,
      alignItems: "center",
      justifyContent: "flex-start",
      paddingTop: 40,
      paddingBottom: 40,
      marginLeft: 0,
      elevation: 10,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      borderLeftWidth: 1,
      borderLeftColor: "#333",
  },
  menuItem: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    // flexDirection: "column" is default for RN Views
  },
  menuText: {
      color: "#0ff",
      fontSize: 14,
      fontFamily: "monospace",
      textAlign: "center",
  },
  menuActionButton: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: "rgba(0,255,255,0.05)",
      width: "90%",
      justifyContent: "flex-start",
  },
  menuActionText: {
      color: "#0ff",
      fontSize: 15,
      fontFamily: "monospace",
      marginLeft: 10,
      fontWeight: "bold",
  },

  topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 12,
  },
  menuButton: {
      position: "absolute",
      top: 20,
      right: 20,
      zIndex: 20,
      padding: 8,
      borderRadius: 8,
      backgroundColor: "rgba(0,255,255,0.08)",
  },
  targetRow: {
      // flexDirection: "row",
      // flexWrap: "wrap", // <-- enables wrapping
      width: "100%",
      alignItems: "center",
      marginVertical: 8,
  },
  swingRow: {
      width: "100%",
      alignItems: "center",
      marginBottom: 8,
  },
  centerRow: {
      flexDirection: "row",
      flexWrap: "wrap", // <-- enables wrapping
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 4,
      gap: 10,
  },
  userInfoContainer: {
    alignItems: 'flex-end',
  },
  userName: {
    color: '#0ff',
    fontSize: 18,
    fontFamily: 'monospace',
  },
  tokenExpiration: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default commonStyles;