import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Switch } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { useSubscriptions } from '../../context/subscriptionContext';

const SubscriptionsScreen = () => {
  const { authenticatedApiFetch } = useAuth();
  const isFocused = useIsFocused();

  const {
    subscriptions,
    isLoading,
    fetchSubscriptions,
    addSubscription,
    updateSubscription,
    deleteSubscription,
  } = useSubscriptions();

  const [thermostats, setThermostats] = useState([]);
  const [selectedThermostat, setSelectedThermostat] = useState(null);
  const [selectedReportType, setSelectedReportType] = useState('daily');

  useEffect(() => {
    const fetchThermostats = async () => {
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
    };

    if (isFocused) {
      fetchSubscriptions();
      fetchThermostats();
    }
  }, [isFocused, fetchSubscriptions, authenticatedApiFetch]);

  const handleAddSubscription = async () => {
    if (!selectedThermostat || !selectedReportType) {
      Alert.alert('Error', 'Please select a thermostat and report type.');
      return;
    }
    await addSubscription({ thermostat_id: selectedThermostat, report_type: selectedReportType });
  };

  const handleToggleActive = async (item) => {
    await updateSubscription(item.id, !item.is_active);
  };

  const handleDeleteSubscription = async (id) => {
    await deleteSubscription(id);
  };

  const renderItem = ({ item }) => (
    <View style={styles.subscriptionItem}>
      <View style={styles.subscriptionDetails}>
        <Text style={styles.subscriptionText}>{item.thermostat_location}</Text>
        <Text style={styles.subscriptionType}>
          {item.report_type.charAt(0).toUpperCase() + item.report_type.slice(1)} Report
        </Text>
      </View>
      <Switch value={!!item.is_active} onValueChange={() => handleToggleActive(item)} />
      <TouchableOpacity onPress={() => handleDeleteSubscription(item.id)} style={styles.deleteButton}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Report Subscriptions</Text>

      <View style={styles.addForm}>
        <Picker
          selectedValue={selectedThermostat}
          onValueChange={(itemValue) => setSelectedThermostat(itemValue)}
          style={styles.picker}
        >
          {thermostats.map((t) => (
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