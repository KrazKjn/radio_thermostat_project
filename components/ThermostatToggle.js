import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const ThermostatToggle = ({ thermostatIp, TempMode }) => {
    const hostname = useContext(HostnameContext);
    const { updateThermostatMode } = useThermostat();

    const modes = [
        { name: "Off", icon: "remove-circle-outline", apiValue: 0 },
        { name: "Heat", icon: "thermometer-outline", apiValue: 1 },
        { name: "Cool", icon: "snow-outline", apiValue: 2 },
        { name: "Auto", icon: "sync-outline", apiValue: 3 },
    ];

    const handleModeChange = (newMode) => {
        updateThermostatMode(thermostatIp, newMode, hostname);
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>Thermostat Mode</Text>
            <View style={commonStyles.digitalRowCenter}>
                {modes.map((mode, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            commonStyles.digitalButton,
                            TempMode === mode.apiValue && commonStyles.digitalActiveButton,
                        ]}
                        onPress={() => handleModeChange(mode.apiValue)}
                    >
                        <Icon
                            name={mode.icon}
                            size={24}
                            color={TempMode === mode.apiValue ? "#fff" : "#777"}
                        />
                        <Text
                            style={[
                                commonStyles.digitalButtonText,
                                TempMode === mode.apiValue && commonStyles.digitalActiveButtonText,
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

export default ThermostatToggle;