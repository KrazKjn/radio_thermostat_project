import { StyleSheet } from "react-native";

// Base Styles
const baseContainer = {
    flex: 1,
    padding: 20,
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

// Refactored Styles
const commonStyles = StyleSheet.create({
    // Containers
    container: { ...baseContainer, alignItems: "center" },
    containerLeft: { ...baseContainer, alignItems: "flex-start" },
    containerScroll: { marginTop: 15, flex: 1 },
    containerSimple: { padding: 10 },
    
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
    buttonIncreaseDecrease: { ...baseButton, backgroundColor: "#007BFF", width: 40, height: 40 },
    setButton: { ...baseButton, backgroundColor: "#28A745", paddingVertical: 10, paddingHorizontal: 20, marginTop: 10 },
    activeButton: { backgroundColor: "#007BFF" },
    
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
    actionDescription: { fontSize: 14, marginBottom: 15, color: "#555", textAlign: "center" },
    
    // Tabs
    tabContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 10 },
    tab: { flex: 1, alignItems: "center", padding: 12, borderRadius: 6, backgroundColor: "#ddd", marginHorizontal: 5 },
    activeTab: { backgroundColor: "#007BFF" },
    tabText: { fontSize: 16, fontWeight: "bold", color: "#333" },
    activeTabText: { color: "#fff" },
    
    // Temperature Controls
    tempContainer: { alignItems: "center", marginVertical: 10 },
    tempDisplay: { fontSize: 18, fontWeight: "bold", marginHorizontal: 10 },
    controls: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
});

export default commonStyles;