import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { HostnameContext } from "../context/HostnameContext";
import { useAuth } from "../context/AuthContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const HoldToggle = ({ thermostatIp, HoldMode }) => {
    const { token } = useAuth();
    const hostname = useContext(HostnameContext);
    const { updateHoldMode } = useThermostat();

    const modes = [
        { name: "Off", icon: "remove-circle-outline", apiValue: 0, description: "Resume following the programmed schedule." },
        { name: "On", icon: "power-outline", apiValue: 1, description: "Hold current temperature indefinitely, ignoring schedule." },
    ];

    const handleHoldModeChange = (newMode) => {
        updateHoldMode(thermostatIp, newMode, hostname, token);
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>🛑 Hold Mode</Text>
            <Text style={commonStyles.status}>
                {HoldMode === 0 ? "Following Schedule" : "Hold Active"}
            </Text>

            {/* Action description */}
            <Text style={commonStyles.actionDescription}>
                {modes.find((mode) => mode.apiValue === HoldMode)?.description}
            </Text>

            <View style={commonStyles.digitalRowCenter}>
                {modes.map((mode, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            commonStyles.digitalButton,
                            HoldMode === mode.apiValue && commonStyles.digitalActiveButton,
                        ]}
                        onPress={() => handleHoldModeChange(mode.apiValue)}
                    >
                        <Icon
                            name={mode.icon}
                            size={24}
                            color={HoldMode === mode.apiValue ? "#fff" : "#777"}
                        />
                        <Text
                            style={[
                                commonStyles.digitalButtonText,
                                HoldMode === mode.apiValue && commonStyles.digitalActiveButtonText,
                            ]}
                        >
                            {mode.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default HoldToggle;