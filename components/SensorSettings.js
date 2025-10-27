import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import commonStyles from '../styles/commonStyles';

const SensorSettings = ({ settings, onSave, onSettingsChange }) => {
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave();
        } finally {
            setSaving(false);
        }
    };

    if (!settings) {
        return (
            <View style={[commonStyles.digitalCard, { margin: 16, alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0ff" />
            </View>
        );
    }

    return (
        <View style={[commonStyles.digitalCard, { margin: 16 }]}>
            <Text style={commonStyles.digitalLabel}>
                <Icon name="hardware-chip-outline" size={22} color="#0ff" /> Sensor Settings
            </Text>
            <View style={commonStyles.digitalRow}>
                <Text style={commonStyles.digitalButtonText}>MQTT Topic</Text>
                <TextInput
                    style={[commonStyles.digitalInput, { flex: 1 }]}
                    value={settings.mqtt_topic || ''}
                    onChangeText={(v) => onSettingsChange({ ...settings, mqtt_topic: v })}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="e.g., shellies/shellyht-123456/status"
                />
            </View>
            <TouchableOpacity
                style={[commonStyles.digitalButton, { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
                onPress={handleSave}
                disabled={saving}
            >
                <Icon name="save-outline" size={22} color="#0ff" />
                <Text style={commonStyles.digitalButtonText}> {saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
        </View>
    );
};

export default SensorSettings;
