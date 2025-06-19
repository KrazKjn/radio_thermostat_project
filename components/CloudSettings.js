import React, { useContext, useEffect, useState } from "react";
import { View, Text, TextInput, Switch, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import commonStyles from "../styles/commonStyles";
import { useThermostat } from "../context/ThermostatContext";
import { useAuth } from "../context/AuthContext";
import { HostnameContext } from "../context/HostnameContext";

const CloudSettings = ({ thermostat }) => {
    const { getCloudSettings, updateCloudSettings, disableThermostat } = useThermostat();
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, [thermostat.thermostatInfo.ip]);

    const fetchSettings = async () => {
        try {
            if (!thermostat.thermostatInfo.ip || thermostat.thermostatInfo.ip === "Loading ...") return;
            // Fetch cloud settings when the component mounts or when the thermostat IP changes
            setLoading(true);
            getCloudSettings(thermostat.thermostatInfo.ip, hostname, token)
                .then(data => setSettings(data))
                .catch(() => {
                    alert("Error", "Failed to fetch cloud settings.");
                    setSettings(null);
                })
                .finally(() => setLoading(false));
        } catch (error) {
            console.error("Error fetching settings:", error);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateCloudSettings(thermostat.thermostatInfo.ip, hostname, token, settings);
            alert("Success", "Cloud settings updated.");
        } catch (e) {
            alert("Error", "Failed to update cloud settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        setRemoving(true);
        try {
            await disableThermostat(hostname, token, thermostat);
            alert("Success", "Cloud settings removed.");
        } catch (e) {
            alert("Error", "Failed to remove cloud settings.");
        } finally {
            setRemoving(false);
        }
    };

    if (loading || !settings) {
        return (
            <View style={[commonStyles.digitalCard, { margin: 16, alignItems: "center" }]}>
                <ActivityIndicator size="large" color="#0ff" />
                <TouchableOpacity
                    style={[commonStyles.digitalButton, { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" }]}
                    onPress={handleRemove}
                    disabled={removing}
                >
                    <Icon name="trash-outline" size={22} color="#0ff" />
                    <Text style={commonStyles.digitalButtonText}> {removing ? "Removing..." : "Remove"}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[commonStyles.digitalCard, { margin: 16 }]}>
            <Text style={commonStyles.digitalLabel}>
                <Icon name="cloud-outline" size={22} color="#0ff" /> Cloud Settings
            </Text>
            {typeof settings.scanMode !== "undefined" ? (
                <View style={commonStyles.digitalRow}>
                    <Text style={commonStyles.digitalButtonText}>Scan Mode</Text>
                    <View style={{ flexDirection: "row", marginLeft: 12 }}>
                        {[0, 1, 2].map(mode => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    commonStyles.digitalButton,
                                    {
                                        backgroundColor: settings.scanMode === mode ? "#0ff" : "#181c20",
                                        marginHorizontal: 4,
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                    }
                                ]}
                                onPress={() => setSettings(s => ({ ...s, scanMode: mode }))}
                            >
                                <Text style={[
                                    commonStyles.digitalButtonText,
                                    { color: settings.scanMode === mode ? "#222" : "#0ff" }
                                ]}>
                                    {mode === 0 ? "Off" : mode === 1 ? "Scan" : "Cloud"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ) : (
                <View style={commonStyles.digitalRow}>
                    <Text style={commonStyles.digitalButtonText}>Enabled</Text>
                    <Switch
                        value={!!settings.enabled}
                        onValueChange={v => setSettings(s => ({ ...s, enabled: v ? 1 : 0 }))}
                    />
                </View>
            )}
            <View style={commonStyles.digitalRow}>
                <Text style={commonStyles.digitalButtonText}>Interval (sec)</Text>
                <TextInput
                    style={commonStyles.digitalInput}
                    keyboardType="numeric"
                    value={String(settings.interval)}
                    onChangeText={v => setSettings(s => ({ ...s, interval: parseInt(v) || 0 }))}
                />
            </View>
            <View style={commonStyles.digitalRow}>
                <Text style={commonStyles.digitalButtonText}>URL</Text>
                <TextInput
                    style={[commonStyles.digitalInput, { flex: 1 }]}
                    value={settings.url}
                    onChangeText={v => setSettings(s => ({ ...s, url: v }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>
            <View style={commonStyles.digitalRow}>
                <Text style={commonStyles.digitalButtonText}>Auth Key</Text>
                <TextInput
                    style={commonStyles.digitalInput}
                    value={settings.authkey}
                    onChangeText={v => setSettings(s => ({ ...s, authkey: v }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>
            <TouchableOpacity
                style={[commonStyles.digitalButton, { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" }]}
                onPress={handleSave}
                disabled={saving}
            >
                <Icon name="save-outline" size={22} color="#0ff" />
                <Text style={commonStyles.digitalButtonText}> {saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[commonStyles.digitalButton, { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" }]}
                onPress={handleRemove}
                disabled={removing}
            >
                <Icon name="trash-outline" size={22} color="#0ff" />
                <Text style={commonStyles.digitalButtonText}> {removing ? "Removing..." : "Remove"}</Text>
            </TouchableOpacity>
        </View>
    );
};

export default CloudSettings;