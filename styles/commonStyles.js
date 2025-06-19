import { StyleSheet } from "react-native";

// Base Styles
const baseContainer = {
    flex: 1,
    padding: 5,
    //backgroundColor: "green" // Uncomment if needed for debugging the UI
};

const baseText = {
    fontSize: 16,
};

const baseButton = {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 5,
};

// Add these at the top of your component file, after imports

const headerStyle = {
  padding: 8,
  backgroundColor: '#007BFF',
  color: '#fff',
  fontWeight: 'bold',
  borderRightWidth: 1,
  borderColor: '#fff',
  textAlign: 'center',
};

const cellStyle = {
  padding: 8,
  backgroundColor: '#f8f9fa',
  color: '#333',
  borderRightWidth: 1,
  borderColor: '#ccc',
  textAlign: 'center',
};

// Refactored Styles
const commonStyles = StyleSheet.create({
    // Containers
    container: { ...baseContainer, alignItems: "center" },
    containerBasic: { ...baseContainer },
    containerLeft: { ...baseContainer, alignItems: "flex-start", paddingLeft: 0 },
    containerScroll: { marginTop: 0, flex: 1 },
    containerSimple: {
      padding: 4,
      // backgroundColor: "red"  // Uncomment if needed for debugging the UI
    },
    containerThermostat: {
       ...baseContainer,
      // backgroundColor: "red"  // Uncomment if needed for debugging the UI
       padding: 0,
       marginBottom: 0,
    },

    // Header & Titles
    headerContainer: { alignItems: "center", marginBottom: 10 },
    headerNetwork: { fontSize: 18, fontWeight: "bold", color: "#007BFF" },
    header: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#333" },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
    
    // Info & Labels
    infoContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
    label: { ...baseText, fontWeight: "bold" },
    value: { ...baseText, color: "#007BFF" },
    valueText: { ...baseText, fontWeight: "bold", marginTop: 10 },
    
    // Inputs
    input: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        padding: 10,
        marginBottom: 16,
        backgroundColor: "#fff",
        fontSize: 16,
    },
    
    // Buttons
    buttonContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 15 },
    buttonContainerLeft: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 15 },
    button: { ...baseButton, backgroundColor: "#ddd", borderRadius: 8 },
    buttonIncreaseDecrease: { ...baseButton, backgroundColor: "#007BFF", fontWeight: "bold", width: 40, height: 40 },
    setButton: { ...baseButton, backgroundColor: "#28A745", fontWeight: "bold", paddingVertical: 10, paddingHorizontal: 20, marginTop: 10, height: 60 },
    activeButton: { backgroundColor: "#007BFF" },
    buttonText: { ...baseButton, color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
    setButtonText: { ...baseButton, color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
    
    // Text & Status
    text: { ...baseText, marginTop: 5, color: "#777" },
    activeText: { color: "#fff" },
    errorText: { color: "red", fontSize: 14, marginBottom: 10 },
    status: { ...baseText, fontWeight: "bold", marginBottom: 5, color: "#007BFF" },
    statusRow: {
      flexDirection: "row",
      flexWrap: "wrap", // ✅ Allows wrapping on smaller screens
      justifyContent: "center", // ✅ Keeps items centered when wrapped
      gap: 15
    },
    statusButton: {
      alignItems: "center",
      padding: 10,
      borderRadius: 8,
      backgroundColor: "#ddd",
      flexDirection: "row",
      gap: 10
    },
    activeStatus: {
      backgroundColor: "#007BFF"
    },
    
    // Item & Action Descriptions
    item: { ...baseText, paddingVertical: 5 },
    actionDescription: { fontSize: 14, marginBottom: 15, color: "rgb(85, 155, 85)", textAlign: "center" },

    // Tabs
    tabContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 2 },
    tab: { flex: 1, alignItems: "center", padding: 12, borderRadius: 6, backgroundColor: "#ddd", marginHorizontal: 5 },
    activeTab: { backgroundColor: "#007BFF" },
    tabText: { fontSize: 16, fontWeight: "bold", color: "#333" },
    activeTabText: { color: "#fff" },
    
    // Temperature Controls
    tempContainer: { alignItems: "center", marginVertical: 10 },
    tempDisplay: { fontSize: 18, fontWeight: "bold", marginHorizontal: 10 },
    controls: { flexDirection: "row", alignItems: "center", marginBottom: 10 },

    scrollContainer: {
      padding: 2,
    },
    infoText: { fontSize: 16, textAlign: "center", marginVertical: 10 },
    
    rowContainer: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
    inputSmall: { borderWidth: 1, padding: 5, width: 60, marginLeft: 10 },

    buttonContainerControl: { flexDirection: "row", justifyContent: "center", marginVertical: 10 },

  saveContainer: {
    alignItems: "center",
    marginVertical: 15,
  },
  saveButton: { ...baseButton, backgroundColor: "#007BFF", borderRadius: 8 },
  usersSaveButton: { ...baseButton, foregroundColor: "#007BFF", backgroundColor: "#333", borderRadius: 8 },

  saveText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },

    // digital styles...
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
    color: "#0ff",
    borderWidth: 1,
    borderColor: "#0ff",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    fontSize: 16,
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
      alignItems: "flex-end",
      justifyContent: "center",
      marginVertical: 4,
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
});

export default commonStyles;