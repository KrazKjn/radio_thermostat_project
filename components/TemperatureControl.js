import React, { useContext, useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const TemperatureControl = ({ thermostatIp, thermostat }) => {
    const hostname = useContext(HostnameContext);
    const { updateThermostatState, updateThermostatTargetTemperature } = useThermostat();
    const [localTemp, setLocalTemp] = useState(thermostat.targetTemp);

    const handleIncrease = () => {
        const newTemp = localTemp + 1;
        setLocalTemp(newTemp);
    };

    const handleDecrease = () => {
        const newTemp = localTemp - 1;
        setLocalTemp(newTemp);
    };

    const handleSetTemperature = async () => {
        try {
            await updateThermostatTargetTemperature(
                thermostatIp,
                hostname,
                thermostat.currentTempMode,
                localTemp
            );
            updateThermostatState(thermostatIp, { targetTemp: localTemp });        
        } catch (error) {
            console.error("Error updating target temperature:", error.message);
            Alert.alert("Error", "Failed to update target temperature.");
        }
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>Target Temperature</Text>
            <View style={commonStyles.digitalTempRow}>
                <TouchableOpacity
                    style={commonStyles.digitalButton}
                    onPress={handleDecrease}
                >
                    <Text style={commonStyles.digitalButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={commonStyles.digitalTarget}>
                    {localTemp}
                    <Text style={commonStyles.digitalUnit}>°F</Text>
                </Text>
                <TouchableOpacity
                    style={commonStyles.digitalButton}
                    onPress={handleIncrease}
                >
                    <Text style={commonStyles.digitalButtonText}>+</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity
                style={commonStyles.digitalButton}
                onPress={handleSetTemperature}
            >
                <Text style={commonStyles.digitalButtonText}>Set</Text>
            </TouchableOpacity>
        </View>
    );
};

export default TemperatureControl;