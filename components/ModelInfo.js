import React, { useState, useEffect, useContext } from "react";
import { View, Text, ActivityIndicator, FlatList } from "react-native";
import { HostnameContext } from "../context/HostnameContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const ModelInfo = ({ ipList }) => {
    const hostname = useContext(HostnameContext);
    const { fetchModelInfoList } = useThermostat();
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState(null);

    useEffect(() => {
        if (hostname) {
            fetchDevices();
        }
    }, [hostname]);

    const fetchDevices = async () => {
        try {
            setLoading(true);
            const fetchedDevices = await fetchModelInfoList(ipList, hostname);
            setDevices(fetchedDevices);
        } catch (error) {
            setErrorMessage("Failed to fetch device information.");
            console.error("Error fetching model info:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={commonStyles.container}>
            <Text style={commonStyles.header}>Device Model Information</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" />
            ) : errorMessage ? (
                <Text style={commonStyles.errorText}>{errorMessage}</Text>
            ) : devices.length > 0 ? (
                <FlatList
                    data={devices}
                    keyExtractor={(item) => item.ip}
                    renderItem={({ item }) => (
                        <Text style={commonStyles.item}>
                            {item.name} - 📡 IP: {item.ip} | 🏷 Model: {item.model}
                        </Text>
                    )}
                />
            ) : (
                <Text style={commonStyles.infoText}>No devices found.</Text>
            )}
        </View>
    );
};

export default ModelInfo;