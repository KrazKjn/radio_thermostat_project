import React, { useState, useEffect } from "react";
import { View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const SwingSlider = ({ thermostatIp }) => {
    const hostname = React.useContext(HostnameContext);
    const { thermostats, fetchSwingValue, updateSwingSetting } = useThermostat();
    const thermostat = thermostats[thermostatIp];
    const [swingValue, setSwingValue] = useState(thermostat?.swingValue ?? 1.0);

    // Fetch current swing setting on component mount
    useEffect(() => {
        if (!thermostatIp || thermostatIp === "Loading ...") {
            return; // Prevent fetch when IP is not ready
        }

        const fetchSwing = async () => {
            try {
                const fetchedSwingValue = await fetchSwingValue(thermostatIp, hostname);
                setSwingValue(fetchedSwingValue);
            } catch (error) {
                console.error("Error fetching swing value:", error);
            }
        };

        fetchSwing();
    }, [thermostatIp, fetchSwingValue, hostname, thermostat?.swingValue]);

    const handleSlidingComplete = (value) => {
        updateSwingSetting(thermostatIp, value, hostname);
    };

    return (
        <View style={commonStyles.digitalCard}>
            <Text style={commonStyles.digitalLabel}>Adjust Swing Setting</Text>
            <Slider
                style={{ width: 250, height: 40 }}
                minimumValue={0.5}
                maximumValue={3.0}
                step={0.5}
                value={swingValue}
                onValueChange={setSwingValue} // Updates UI instantly
                onSlidingComplete={handleSlidingComplete} // Sends to API
                minimumTrackTintColor="#007BFF"
                maximumTrackTintColor="#ddd"
                thumbTintColor="#007BFF"
            />
            <Text style={commonStyles.digitalSlider}>
                Swing: {swingValue.toFixed(1)}
            </Text>
        </View>
    );
};

export default SwingSlider;