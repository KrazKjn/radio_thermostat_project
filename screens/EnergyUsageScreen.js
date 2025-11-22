import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import { Picker } from '@react-native-picker/picker';
import commonStyles from '../styles/commonStyles';

const Logger = require('../components/Logger');

const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const ReportSection = ({ title, data, level = 0 }) => {
  const [expanded, setExpanded] = useState(level < 2);
  if (!data || !data.summary) return null;

  const styles = getStyles(level);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.summaryText}>
          Cost: ${data.summary.total.cost.toFixed(2)} | Runtime: {(data.summary.total.runtime / 60).toFixed(2)} hrs
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          {data.months &&
            Object.entries(data.months).map(([month, monthData]) => (
              <ReportSection
                key={month}
                title={`Month: ${months[month - 1]}`}
                data={monthData}
                level={level + 1}
              />
            ))}
          {data.weeks &&
            Object.entries(data.weeks).map(([week, weekData]) => (
              <ReportSection key={week} title={`Week: ${week}`} data={weekData} level={level + 1} />
            ))}
          {data.days &&
            Object.entries(data.days).map(([day, dayData]) => (
              <DayDetail key={day} title={`Day: ${day}`} data={dayData} level={level + 1} />
            ))}
        </View>
      )}
    </View>
  );
};

const DayDetail = ({ title, data, level }) => {
  const styles = getStyles(level);
  return (
    <View style={[styles.container, styles.dayContainer]}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.detailsGrid}>
        <Text style={styles.detailText}>Total Cost: ${data.total.cost.toFixed(2)}</Text>
        <Text style={styles.detailText}>Total Runtime: {(data.total.runtime / 60).toFixed(2)} hrs</Text>
      </View>

      <View style={styles.detailsGrid}>
        <Text style={styles.detailText}>Heating Cost: ${data.heating.cost.toFixed(2)}</Text>
        <Text style={styles.detailText}>Heating Consumption: {data.heating.consumption.toFixed(2)} Gallons</Text>
        <Text style={styles.detailText}>Heating Fan Cost: ${data.heating.fan.cost.toFixed(2)}</Text>
        <Text style={styles.detailText}>Heating Fan Runtime: {(data.heating.fan.runtime / 60).toFixed(2)} hrs</Text>
      </View>

      <View style={styles.detailsGrid}>
        <Text style={styles.detailText}>Cooling Cost: ${data.cooling.cost.toFixed(2)}</Text>
        <Text style={styles.detailText}>Cooling Consumption: {data.cooling.consumption.toFixed(2)} KwH</Text>
        <Text style={styles.detailText}>Cooling Fan Cost: ${data.cooling.fan.cost.toFixed(2)}</Text>
        <Text style={styles.detailText}>Cooling Fan Runtime: {(data.cooling.fan.runtime / 60).toFixed(2)} hrs</Text>
      </View>
    </View>
  );
};

const EnergyUsageScreen = () => {
    const hostname = useContext(HostnameContext);
    const { getThermostats, getEnergyUsage } = useThermostat();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [thermostats, setThermostats] = useState([]);
    const [selectedThermostat, setSelectedThermostat] = useState('Whole Home');

    useEffect(() => {
        const fetchThermostats = async () => {
            try {
                const data = await getThermostats(hostname);
                setThermostats(data || []);
                if (data && data.length > 0) {
                    setSelectedThermostat(data[0].ip);
                }
            } catch (err) {
                Logger.error(`Error fetching thermostats: ${err.message}`, 'EnergyUsage', 'fetchThermostats');
                setError('Failed to fetch thermostats');
            }
        };
        fetchThermostats();
    }, [hostname]);

    useEffect(() => {
        if (!selectedThermostat) return;

        const fetchReport = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await getEnergyUsage(selectedThermostat, hostname);
                setReportData(data);
            } catch (err) {
                Logger.error(`Error fetching consumption report: ${err.message}`, 'EnergyUsageScreen', 'fetchReport');
                setError('Failed to fetch consumption report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [selectedThermostat, hostname]);

    return (
        <ScrollView contentContainerStyle={commonStyles.container}>
        <Text style={commonStyles.headerNetwork}>Energy Usage Report</Text>

        <View style={commonStyles.containerSimple}>
            <Picker
                selectedValue={selectedThermostat}
                onValueChange={(itemValue) => setSelectedThermostat(itemValue)}
                style={commonStyles.input}
                >
                {
                    thermostats.length === 0 && <Picker.Item key={'NT'} label="No Thermostats Available" value={'NA'} />
                }
                {
                    thermostats.length > 0 && <Picker.Item key={'all'} label="Whole Home" value={'all'} />
                }
                {thermostats.map(t => (
                    <Picker.Item key={t.ip} label={t.location} value={t.ip} />
                ))}
            </Picker>
        </View>

        {loading && <ActivityIndicator size="large" />}
        {error && <Text style={commonStyles.errorText}>{error}</Text>}

        {reportData &&
            Object.entries(reportData).map(([year, yearData]) => (
            <ReportSection key={year} title={`Year: ${year}`} data={yearData} />
            ))}
        </ScrollView>
    );
};

const getStyles = (level) => ({
  container: {
    marginLeft: level * 15,
    borderLeftWidth: 2,
    borderLeftColor: `rgba(0,0,0,${0.1 * (level + 1)})`,
    paddingLeft: 10,
    marginVertical: 5,
  },
  header: {
    backgroundColor: `rgba(0,122,255,${0.1 * (level + 1)})`,
    padding: 10,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16 - level,
    color: '#007bffff',
  },
  summaryText: {
    fontSize: 14 - level,
    color: '#9f9c9cff',
  },
  content: {
    marginTop: 5,
  },
  dayContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 4,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  detailText: {
    width: '48%',
    fontSize: 13,
    marginVertical: 2,
    color: '#843232ff',
  },
});

export default EnergyUsageScreen;
