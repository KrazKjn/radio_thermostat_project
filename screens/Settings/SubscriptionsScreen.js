// TODO: Frontend verification was skipped for this component due to known
// environmental issues with running the Expo web server for Playwright.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

const SubscriptionsScreen = () => {
    const { authenticatedApiFetch } = useAuth();
    const isFocused = useIsFocused();
    const [subscriptions, setSubscriptions] = useState([]);
    const [thermostats, setThermostats] = useState([]);
    const [selectedThermostat, setSelectedThermostat] = useState(null);
    const [selectedReportType, setSelectedReportType] = useState('daily');
    const [isLoading, setIsLoading] = useState(false);

    const fetchSubscriptions = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await authenticatedApiFetch('/api/subscriptions');
            setSubscriptions(data);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch subscriptions.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [authenticatedApiFetch]);

    const fetchThermostats = useCallback(async () => {
        try {
            const data = await authenticatedApiFetch('/api/thermostats');
            setThermostats(data);
            if (data.length > 0) {
                setSelectedThermostat(data[0].id);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch thermostats.');
            console.error(error);
        }
    }, [authenticatedApiFetch]);

    useEffect(() => {
        if (isFocused) {
            fetchSubscriptions();
            fetchThermostats();
        }
    }, [isFocused, fetchSubscriptions, fetchThermostats]);

    const handleAddSubscription = async () => {
        if (!selectedThermostat || !selectedReportType) {
            Alert.alert('Error', 'Please select a thermostat and report type.');
            return;
        }
        try {
            await authenticatedApiFetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    thermostat_id: selectedThermostat,
                    report_type: selectedReportType,
                }),
            });
            Alert.alert('Success', 'Subscription added!');
            fetchSubscriptions(); // Refresh the list
        } catch (error) {
            if (error.status === 409) {
                 Alert.alert('Error', 'This subscription already exists.');
            } else {
                 Alert.alert('Error', 'Failed to add subscription.');
            }
            console.error(error);
        }
    };

    const handleDeleteSubscription = async (id) => {
        try {
            await authenticatedApiFetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
            Alert.alert('Success', 'Subscription removed.');
            fetchSubscriptions(); // Refresh the list
        } catch (error) {
            Alert.alert('Error', 'Failed to remove subscription.');
            console.error(error);
        }
    };

    const handleToggleActive = async (item) => {
        try {
            await authenticatedApiFetch(`/api/subscriptions/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !item.is_active }),
            });
            // Optimistically update UI or refetch
            setSubscriptions(prev =>
                prev.map(sub =>
                    sub.id === item.id ? { ...sub, is_active: !sub.is_active } : sub
                )
            );
        } catch (error) {
            Alert.alert('Error', 'Failed to update subscription status.');
            console.error(error);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.subscriptionItem}>
            <View style={styles.subscriptionDetails}>
                <Text style={styles.subscriptionText}>{item.thermostat_location}</Text>
                <Text style={styles.subscriptionType}>{item.report_type.charAt(0).toUpperCase() + item.report_type.slice(1)} Report</Text>
            </View>
            <Switch
                value={!!item.is_active}
                onValueChange={() => handleToggleActive(item)}
            />
            <TouchableOpacity onPress={() => handleDeleteSubscription(item.id)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Manage Report Subscriptions</Text>

            {/* Add Subscription Form */}
            <View style={styles.addForm}>
                <Picker
                    selectedValue={selectedThermostat}
                    onValueChange={(itemValue) => setSelectedThermostat(itemValue)}
                    style={styles.picker}
                >
                    {thermostats.map(t => (
                        <Picker.Item key={t.id} label={t.location} value={t.id} />
                    ))}
                </Picker>
                <Picker
                    selectedValue={selectedReportType}
                    onValueChange={(itemValue) => setSelectedReportType(itemValue)}
                    style={styles.picker}
                >
                    <Picker.Item label="Daily" value="daily" />
                    <Picker.Item label="Weekly" value="weekly" />
                    <Picker.Item label="Monthly" value="monthly" />
                </Picker>
                <TouchableOpacity onPress={handleAddSubscription} style={styles.addButton}>
                    <Text style={styles.addButtonText}>Add Subscription</Text>
                </TouchableOpacity>
            </View>

            {/* Subscription List */}
            <FlatList
                data={subscriptions}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                refreshing={isLoading}
                onRefresh={fetchSubscriptions}
                ListEmptyComponent={<Text style={styles.emptyText}>No subscriptions found.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    addForm: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: 'white',
        borderRadius: 8,
        elevation: 2,
    },
    picker: {
        height: 50,
        width: '100%',
        marginBottom: 10,
    },
    addButton: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    subscriptionItem: {
        backgroundColor: 'white',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 1,
    },
    subscriptionDetails: {
        flex: 1,
    },
    subscriptionText: {
        fontSize: 16,
        fontWeight: '500',
    },
    subscriptionType: {
        fontSize: 14,
        color: '#666',
    },
    deleteButton: {
        marginLeft: 10,
        backgroundColor: '#dc3545',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 5,
    },
    deleteButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 30,
        fontSize: 16,
        color: '#888',
    },
});

export default SubscriptionsScreen;
