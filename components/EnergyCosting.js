import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { HostnameContext } from '../context/HostnameContext';
import commonStyles from '../styles/commonStyles';

const EnergyCosting = () => {
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const [costingData, setCostingData] = useState([]);
    const [energyTypes, setEnergyTypes] = useState([]);
    const [unitTypes, setUnitTypes] = useState([]);
    const [editingEntry, setEditingEntry] = useState(null);
    const [newEntry, setNewEntry] = useState({
        effective_start_date: new Date().getTime(),
        energy_type_id: '',
        cost_per_unit: '',
        unit_type_id: ''
    });

    const fetchData = async () => {
        try {
            const [costingRes, energyTypesRes, unitTypesRes] = await Promise.all([
                fetch(`${hostname}/energy/costing`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${hostname}/energy/types`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${hostname}/energy/units`, { headers: { Authorization: `Bearer ${token}` } })
            ]);
            const costing = await costingRes.json();
            const energyTypes = await energyTypesRes.json();
            const unitTypes = await unitTypesRes.json();
            setCostingData(costing);
            setEnergyTypes(energyTypes);
            setUnitTypes(unitTypes);
        } catch (error) {
            console.error('Error fetching energy data:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = async () => {
        try {
            await fetch(`${hostname}/energy/costing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(newEntry)
            });
            fetchData();
        } catch (error) {
            console.error('Error adding energy costing data:', error);
        }
    };

    const handleUpdate = async () => {
        try {
            await fetch(`${hostname}/energy/costing/${editingEntry.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(editingEntry)
            });
            fetchData();
            setEditingEntry(null);
        } catch (error) {
            console.error('Error updating energy costing data:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await fetch(`${hostname}/energy/costing/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (error) {
            console.error('Error deleting energy costing data:', error);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={commonStyles.header}>Energy Costing</Text>
            <View style={styles.form}>
                {/* To-Do: Replace with a date picker component */}
                <TextInput
                    style={styles.input}
                    placeholder="Effective Start Date (YYYY-MM-DD)"
                    onChangeText={(text) => editingEntry ? setEditingEntry({ ...editingEntry, effective_start_date: new Date(text).getTime() }) : setNewEntry({ ...newEntry, effective_start_date: new Date(text).getTime() })}
                    value={editingEntry ? new Date(editingEntry.effective_start_date).toISOString().split('T')[0] : new Date(newEntry.effective_start_date).toISOString().split('T')[0]}
                />
                <Picker
                    selectedValue={editingEntry ? editingEntry.energy_type_id : newEntry.energy_type_id}
                    style={styles.picker}
                    onValueChange={(itemValue) => editingEntry ? setEditingEntry({ ...editingEntry, energy_type_id: itemValue }) : setNewEntry({ ...newEntry, energy_type_id: itemValue })}
                >
                    {energyTypes.map((type) => (
                        <Picker.Item key={type.id} label={type.name} value={type.id} />
                    ))}
                </Picker>
                <TextInput
                    style={styles.input}
                    placeholder="Cost Per Unit"
                    onChangeText={(text) => editingEntry ? setEditingEntry({ ...editingEntry, cost_per_unit: text }) : setNewEntry({ ...newEntry, cost_per_unit: text })}
                    value={editingEntry ? editingEntry.cost_per_unit.toString() : newEntry.cost_per_unit}
                />
                <Picker
                    selectedValue={editingEntry ? editingEntry.unit_type_id : newEntry.unit_type_id}
                    style={styles.picker}
                    onValueChange={(itemValue) => editingEntry ? setEditingEntry({ ...editingEntry, unit_type_id: itemValue }) : setNewEntry({ ...newEntry, unit_type_id: itemValue })}
                >
                    {unitTypes.map((type) => (
                        <Picker.Item key={type.id} label={type.name} value={type.id} />
                    ))}
                </Picker>
                <Button title={editingEntry ? "Save" : "Add"} onPress={editingEntry ? handleUpdate : handleAdd} />
            </View>
            <FlatList
                data={costingData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.listItem}>
                        <Text>{`Effective: ${new Date(item.effective_start_date).toLocaleDateString()}`}</Text>
                        <Text>{`Cost: ${item.cost_per_unit}`}</Text>
                        <Button title="Edit" onPress={() => setEditingEntry(item)} />
                        <Button title="Delete" onPress={() => handleDelete(item.id)} />
                    </View>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20
    },
    form: {
        marginBottom: 20
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 10
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc'
    }
});

export default EnergyCosting;
