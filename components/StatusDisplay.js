import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/Ionicons"; // Ensure this package is installed
import commonStyles from "../styles/commonStyles";

const StatusDisplay = ({ thermostatData }) => {
  const currentTempState = thermostatData.currentTempState ?? 3; // Default to Unknown
  const currentFanState = thermostatData.currentFanState ?? 0; // Default to Idle

  const hvacIcons = {
    0: "bed-outline",     // Idle/Sleeping
    1: "flame-outline",   // Heating
    2: "snow-outline",    // Cooling
    3: "help-circle-outline" // Unknown
  };

  const fanIcons = {
    0: "ellipse-outline", // Fan Idle
    //1: "sync-outline"     // Fan On
    1: "power-outline"     // Fan On
  };

  return (
    <View style={commonStyles.digitalCard}>
      <Text style={commonStyles.digitalLabel}>HVAC & Fan Status</Text>
      <View style={commonStyles.digitalRowCenter}>
        {/* HVAC Status Button */}
        <View style={[commonStyles.digitalButton, currentTempState !== 0 && commonStyles.digitalActiveButton]}>
          <Icon name={hvacIcons[currentTempState]} size={24} color={currentTempState !== 0 ? "#fff" : "#777"} />
          <Text style={[commonStyles.digitalButtonText, currentTempState !== 0 && commonStyles.digitalActiveButtonText]}>
            {["Idle/Sleeping", "Heating", "Cooling", "Unknown"][currentTempState]}
          </Text>
        </View>

        {/* Fan Status Button */}
        <View style={[commonStyles.digitalButton, currentFanState !== 0 && commonStyles.digitalActiveButton]}>
          <Icon name={fanIcons[currentFanState]} size={24} color={currentFanState !== 0 ? "#fff" : "#777"} />
          <Text style={[commonStyles.digitalButtonText, currentFanState !== 0 && commonStyles.digitalActiveButtonText]}>
            {currentFanState === 0 ? "Idle/Sleeping" : "On"}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default StatusDisplay;