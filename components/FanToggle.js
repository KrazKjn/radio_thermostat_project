import React, { useContext } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";
import { HVAC_FAN_OPTIONS, HVAC_FAN_COLORS, HVAC_FAN_ICON_SIZES } from '../constants/hvac_fan';

const FanToggle = ({ thermostatIp, FanMode }) => {
    const hostname = useContext(HostnameContext);
    const { updateFanMode } = useThermostat();

    const modes = HVAC_FAN_OPTIONS;

    const handleFanModeChange = (newMode) => {
        updateFanMode(thermostatIp, newMode, hostname);
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>Fan Mode</Text>
            <View style={commonStyles.digitalRowCenter}>
                {modes.map((mode, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            commonStyles.digitalButton,
                            FanMode === mode.value && commonStyles.digitalActiveButton,
                        ]}
                        onPress={() => handleFanModeChange(mode.value)}
                    >
                        <Icon
                            name={mode.icon}
                            size={HVAC_FAN_ICON_SIZES[mode.value] || 24}
                            color={FanMode === mode.value ? "#fff" : "#777"}
                            //color={HVAC_FAN_COLORS[mode.value] || "#777"}
                            // Use the color from HVAC_FAN_COLORS based on mode.value
                        />
                        <Text
                            style={[
                                commonStyles.digitalButtonText,
                                FanMode === mode.value && commonStyles.digitalActiveButtonText,
                            ]}
                        >
                            {mode.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default FanToggle;