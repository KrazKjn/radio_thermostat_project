import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import CloudSettings from './CloudSettings';
import SensorSettings from './SensorSettings'; // Import the new component
import commonStyles from '../styles/commonStyles';

const SettingsScreen = () => {
    const {
        getThermostats,
        getCloudSettings,
        updateCloudSettings,
        disableThermostat,
        getSensorSettings,
        updateSensorSettings
    } = useThermostat();
    const hostname = useContext(HostnameContext);
    const [thermostats, setThermostats] = useState([]);
    const [selectedThermostat, setSelectedThermostat] = useState(null);
    const [cloudSettings, setCloudSettings] = useState(null);
    const [sensorSettings, setSensorSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchThermostats = async () => {
            try {
                const data = await getThermostats(hostname);
                setThermostats(data);
                if (data.length > 0) {
                    setSelectedThermostat(data[0]);
                }
            } catch (error) {
                Alert.alert("Error", "Failed to fetch thermostats.");
            }
        };
        fetchThermostats();
    }, [hostname]);

    useEffect(() => {
        if (selectedThermostat) {
            fetchSettings(selectedThermostat.ip);
        }
    }, [selectedThermostat]);

    const fetchSettings = async (ip) => {
        setLoading(true);
        try {
            const [cloudData, sensorData] = await Promise.all([
                getCloudSettings(ip, hostname),
                getSensorSettings(ip, hostname)
            ]);
            setCloudSettings(cloudData);
            setSensorSettings(sensorData);
        } catch (error) {
            Alert.alert("Error", "Failed to fetch settings.");
            setCloudSettings(null);
            setSensorSettings(null);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCloud = async () => {
        if (!selectedThermostat) return;
        try {
            await updateCloudSettings(selectedThermostat.ip, hostname, cloudSettings);
            Alert.alert("Success", "Cloud settings updated.");
        } catch (e) {
            Alert.alert("Error", "Failed to update cloud settings.");
        }
    };

    const handleSaveSensor = async () => {
        if (!selectedThermostat) return;
        try {
            await updateSensorSettings(selectedThermostat.ip, hostname, sensorSettings);
            Alert.alert("Success", "Sensor settings updated.");
        } catch (e) {
            Alert.alert("Error", "Failed to update sensor settings.");
        }
    };

    const handleRemove = async () => {
        if (!selectedThermostat) return;
        try {
            await disableThermostat(hostname, selectedThermostat);
            Alert.alert("Success", "Thermostat disabled.");
            // Refresh the list of thermostats
            const data = await getThermostats(hostname);
            setThermostats(data);
            if (data.length > 0) {
                setSelectedThermostat(data[0]);
            } else {
                setSelectedThermostat(null);
            }
        } catch (e) {
            Alert.alert("Error", "Failed to disable thermostat.");
        }
    };

    return (
        <ScrollView style={commonStyles.container}>
            <Text style={commonStyles.header}>Settings</Text>
            {thermostats.length > 0 ? (
                <Picker
                    selectedValue={selectedThermostat?.ip}
                    onValueChange={(itemValue) => {
                        const thermostat = thermostats.find(t => t.ip === itemValue);
                        setSelectedThermostat(thermostat);
                    }}
                    style={commonStyles.picker}
                >
                    {thermostats.map((thermostat) => (
                        <Picker.Item key={thermostat.ip} label={thermostat.name} value={thermostat.ip} />
                    ))}
                </Picker>
            ) : (
                <ActivityIndicator size="large" color="#0ff" />
            )}

            {loading ? (
                <ActivityIndicator size="large" color="#0ff" />
            ) : (
                <>
                    <CloudSettings
                        settings={cloudSettings}
                        onSave={handleSaveCloud}
                        onRemove={handleRemove}
                        onSettingsChange={setCloudSettings}
                    />
                    <SensorSettings
                        settings={sensorSettings}
                        onSave={handleSaveSensor}
                        onSettingsChange={setSensorSettings}
                    />
                </>
            )}
        </ScrollView>
    );
};

export default SettingsScreen;
