import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const OverrideToggle = ({ thermostatIp, OverrideMode }) => {
    const hostname = useContext(HostnameContext);
    const { updateOverrideMode } = useThermostat();

    const modes = [
        { name: "Off", icon: "remove-circle-outline", apiValue: 0, description: "Resume the preset schedule." },
        { name: "On", icon: "power-outline", apiValue: 1, description: "Hold the current temperature until the next scheduled change." },
    ];

    const handleOverrideModeChange = (newMode) => {
        updateOverrideMode(thermostatIp, newMode, hostname);
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>⚡ Override Mode</Text>
            <Text style={commonStyles.status}>
                {OverrideMode === 0 ? "Following Schedule" : "Override Active"}
            </Text>

            {/* Action description */}
            <Text style={commonStyles.actionDescription}>
                {modes.find((mode) => mode.apiValue === OverrideMode)?.description}
            </Text>

            <View style={commonStyles.digitalRowCenter}>
                {modes.map((mode, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            commonStyles.digitalButton,
                            OverrideMode === mode.apiValue && commonStyles.digitalActiveButton,
                        ]}
                        onPress={() => handleOverrideModeChange(mode.apiValue)}
                    >
                        <Icon
                            name={mode.icon}
                            size={24}
                            color={OverrideMode === mode.apiValue ? "#fff" : "#777"}
                        />
                        <Text
                            style={[
                                commonStyles.digitalButtonText,
                                OverrideMode === mode.apiValue && commonStyles.digitalActiveButtonText,
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

export default OverrideToggle;