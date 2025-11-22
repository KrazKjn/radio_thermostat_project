import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../../context/AuthContext';
import { HostnameContext } from '../../context/HostnameContext';
import commonStyles from '../../styles/commonStyles';

const EnergyCostingScreen = () => {
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
  const [colWidths, setColWidths] = useState({
    date: 140,
    energy: 120,
    cost: 100,
    unit: 100,
    actions: 140
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [costingRes, energyTypesRes, unitTypesRes] = await Promise.all([
          fetch(`${hostname}/energy/costing`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${hostname}/energy/types`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${hostname}/energy/units`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setCostingData(await costingRes.json());
        setEnergyTypes(await energyTypesRes.json());
        setUnitTypes(await unitTypesRes.json());
      } catch (error) {
        console.error('Error fetching energy data:', error);
      }
    };
    fetchData();
  }, []);

  const handleAddOrUpdate = async () => {
    const entry = editingEntry || newEntry;
    const method = editingEntry ? 'PUT' : 'POST';
    const url = editingEntry ? `${hostname}/energy/costing/${editingEntry.id}` : `${hostname}/energy/costing`;

    try {
      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(entry)
      });
      setEditingEntry(null);
      setNewEntry({ effective_start_date: new Date().getTime(), energy_type_id: '', cost_per_unit: '', unit_type_id: '' });
      const res = await fetch(`${hostname}/energy/costing`, { headers: { Authorization: `Bearer ${token}` } });
      setCostingData(await res.json());
    } catch (error) {
      console.error('Error saving energy costing data:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${hostname}/energy/costing/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const res = await fetch(`${hostname}/energy/costing`, { headers: { Authorization: `Bearer ${token}` } });
      setCostingData(await res.json());
    } catch (error) {
      console.error('Error deleting energy costing data:', error);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.container}>
      <Text style={commonStyles.headerNetwork}>Energy Costing</Text>
      <View style={commonStyles.containerSimple}>
        <TextInput
          style={commonStyles.input}
          placeholder="Effective Start Date (YYYY-MM-DD)"
          value={
            new Date((editingEntry || newEntry).effective_start_date)
              .toISOString()
              .split('T')[0]
          }
          onChangeText={(text) => {
            const timestamp = new Date(text).getTime();
            editingEntry
              ? setEditingEntry({ ...editingEntry, effective_start_date: timestamp })
              : setNewEntry({ ...newEntry, effective_start_date: timestamp });
          }}
        />
        <Picker
          selectedValue={(editingEntry || newEntry).energy_type_id}
          style={commonStyles.input}
          onValueChange={(value) =>
            editingEntry
              ? setEditingEntry({ ...editingEntry, energy_type_id: value })
              : setNewEntry({ ...newEntry, energy_type_id: value })
          }
        >
          <Picker.Item label="Select Energy Type" value="" />
          {energyTypes.map((type) => (
            <Picker.Item key={type.id} label={type.name} value={type.id} />
          ))}
        </Picker>
        <TextInput
          style={commonStyles.input}
          placeholder="Cost Per Unit"
          value={(editingEntry || newEntry).cost_per_unit.toString()}
          onChangeText={(text) =>
            editingEntry
              ? setEditingEntry({ ...editingEntry, cost_per_unit: text })
              : setNewEntry({ ...newEntry, cost_per_unit: text })
          }
        />
        <Picker
          selectedValue={(editingEntry || newEntry).unit_type_id}
          style={commonStyles.input}
          onValueChange={(value) =>
            editingEntry
              ? setEditingEntry({ ...editingEntry, unit_type_id: value })
              : setNewEntry({ ...newEntry, unit_type_id: value })
          }
        >
          <Picker.Item label="Select Unit Type" value="" />
          {unitTypes.map((type) => (
            <Picker.Item key={type.id} label={type.name} value={type.id} />
          ))}
        </Picker>
        <TouchableOpacity style={commonStyles.saveButton} onPress={handleAddOrUpdate}>
          <Text style={commonStyles.saveText}>{editingEntry ? 'Save' : 'Add'}</Text>
        </TouchableOpacity>
      </View>
      <View style={[commonStyles.containerSimple, { backgroundColor: '#007BFF' }]}>
        <View style={[commonStyles.rowContainer, { backgroundColor: '#f8f9fa', borderRadius: 4, borderBottomWidth: 1, borderColor: '#ccc' }]}>
          <Text style={{ color: '#007BFF', padding: 8, width: colWidths.date, fontWeight: 'bold' }}>Start Date</Text>
          <Text style={{ color: '#007BFF', padding: 8, width: colWidths.energy, fontWeight: 'bold' }}>Energy Type</Text>
          <Text style={{ color: '#007BFF', padding: 8, width: colWidths.cost, fontWeight: 'bold' }}>Cost</Text>
          <Text style={{ color: '#007BFF', padding: 8, width: colWidths.unit, fontWeight: 'bold' }}>Unit</Text>
          <Text style={{ color: '#007BFF', padding: 8, width: colWidths.actions, fontWeight: 'bold' }}>Actions</Text>
        </View>

        {costingData.map((item) => {
          const isEditing = editingEntry && editingEntry.id === item.id;
          const energyLabel = energyTypes.find(e => e.id === item.energy_type_id)?.name || '';
          const unitLabel = unitTypes.find(u => u.id === item.unit_type_id)?.name || '';

          return (
            <View key={item.id} style={commonStyles.rowContainer}>
              {isEditing ? (
                <>
                  <TextInput
                    style={[commonStyles.input, { width: colWidths.date }]}
                    value={new Date(editingEntry.effective_start_date).toISOString().split('T')[0]}
                    onChangeText={(text) =>
                      setEditingEntry({ ...editingEntry, effective_start_date: new Date(text).getTime() })
                    }
                  />
                  <Picker
                    selectedValue={editingEntry.energy_type_id}
                    style={{ width: colWidths.energy }}
                    onValueChange={(value) =>
                      setEditingEntry({ ...editingEntry, energy_type_id: value })
                    }
                  >
                    {energyTypes.map((type) => (
                      <Picker.Item key={type.id} label={type.name} value={type.id} />
                    ))}
                  </Picker>
                  <TextInput
                    style={[commonStyles.input, { width: colWidths.cost }]}
                    value={editingEntry.cost_per_unit.toString()}
                    onChangeText={(text) =>
                      setEditingEntry({ ...editingEntry, cost_per_unit: text })
                    }
                  />
                  <Picker
                    selectedValue={editingEntry.unit_type_id}
                    style={{ width: colWidths.unit }}
                    onValueChange={(value) =>
                      setEditingEntry({ ...editingEntry, unit_type_id: value })
                    }
                  >
                    {unitTypes.map((type) => (
                      <Picker.Item key={type.id} label={type.name} value={type.id} />
                    ))}
                  </Picker>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: colWidths.actions }}>
                    <TouchableOpacity onPress={handleAddOrUpdate} style={commonStyles.usersSaveButton}>
                      <Text style={commonStyles.saveText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setEditingEntry(null)} style={commonStyles.button}>
                      <Text style={commonStyles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ color: '#333', padding: 8, width: colWidths.date }}>
                    {new Date(item.effective_start_date).toLocaleDateString()}
                  </Text>
                  <Text style={{ color: '#333', padding: 8, width: colWidths.energy }}>{energyLabel}</Text>
                  <Text style={{ color: '#333', padding: 8, width: colWidths.cost }}>{item.cost_per_unit}</Text>
                  <Text style={{ color: '#333', padding: 8, width: colWidths.unit }}>{unitLabel}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', width: colWidths.actions }}>
                    <TouchableOpacity onPress={() => setEditingEntry(item)} style={commonStyles.button}>
                      <Text style={commonStyles.buttonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={commonStyles.button}>
                      <Text style={commonStyles.buttonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

export default EnergyCostingScreen;
