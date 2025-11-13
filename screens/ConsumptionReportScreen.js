// TODO: Frontend verification of this component could not be completed due to issues running the application.
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import { Picker } from '@react-native-picker/picker';
import commonStyles from '../styles/commonStyles';

const Logger = require('../components/Logger');

const ReportSection = ({ title, data, level = 0 }) => {
    const [expanded, setExpanded] = useState(level < 2); // Auto-expand years and months

    if (!data || !data.summary) {
        return null;
    }

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
                    {data.months && Object.entries(data.months).map(([month, monthData]) => (
                        <ReportSection key={month} title={`Month: ${month}`} data={monthData} level={level + 1} />
                    ))}
                    {data.weeks && Object.entries(data.weeks).map(([week, weekData]) => (
                        <ReportSection key={week} title={`Week: ${week}`} data={weekData} level={level + 1} />
                    ))}
                    {data.days && Object.entries(data.days).map(([day, dayData]) => (
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
                <Text style={styles.detailText}>HVAC Cost: ${data.hvac.cost.toFixed(2)}</Text>
                <Text style={styles.detailText}>HVAC Runtime: {(data.hvac.runtime / 60).toFixed(2)} hrs</Text>
                <Text style={styles.detailText}>HVAC Consumption: {data.hvac.consumption.toFixed(2)} units</Text>
            </View>
            <View style={styles.detailsGrid}>
                <Text style={styles.detailText}>Fan Cost: ${data.fan.cost.toFixed(2)}</Text>
                <Text style={styles.detailText}>Fan Runtime: {(data.fan.runtime / 60).toFixed(2)} hrs</Text>
                <Text style={styles.detailText}>Fan Consumption: {data.fan.consumption.toFixed(2)} kWh</Text>
            </View>
        </View>
    );
};

const ConsumptionReportScreen = () => {
    const hostname = useContext(HostnameContext);
    const { getThermostats, getConsumptionReport } = useThermostat();
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [thermostats, setThermostats] = useState([]);
    const [selectedThermostat, setSelectedThermostat] = useState(null);

    useEffect(() => {
        const fetchThermostats = async () => {
            try {
                const data = await getThermostats(hostname);
                setThermostats(data || []);
                if (data && data.length > 0) {
                    setSelectedThermostat(data[0].ip);
                }
            } catch (err) {
                Logger.error(`Error fetching thermostats: ${err.message}`, 'ConsumptionReport', 'fetchThermostats');
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
                const data = await getConsumptionReport(selectedThermostat, hostname);
                setReportData(data);
            } catch (err) {
                Logger.error(`Error fetching consumption report: ${err.message}`, 'ConsumptionReport', 'fetchReport');
                setError('Failed to fetch consumption report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, [selectedThermostat, hostname]);

    return (
        <ScrollView style={commonStyles.container}>
            <Text style={commonStyles.header}>Consumption Report</Text>
            <Picker
                selectedValue={selectedThermostat}
                onValueChange={(itemValue) => setSelectedThermostat(itemValue)}
                style={commonStyles.picker}
            >
                {thermostats.map(t => <Picker.Item key={t.ip} label={t.name} value={t.ip} />)}
            </Picker>
            {loading && <ActivityIndicator size="large" />}
            {error && <Text style={commonStyles.errorText}>{error}</Text>}
            {reportData && Object.entries(reportData).map(([year, yearData]) => (
                <ReportSection key={year} title={`Year: ${year}`} data={yearData} />
            ))}
        </ScrollView>
    );
};

const getStyles = (level) => StyleSheet.create({
    container: {
        marginLeft: level * 15,
        borderLeftWidth: 2,
        borderLeftColor: `rgba(0,0,0,${0.1 * (level + 1)})`,
        paddingLeft: 10,
        marginVertical: 5,
    },
    dayContainer: {
        backgroundColor: '#f9f9f9',
        padding: 10,
        borderRadius: 5,
    },
    header: {
        backgroundColor: `rgba(0,122,255,${0.1 * (level + 1)})`,
        padding: 10,
        borderRadius: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    title: {
        fontWeight: 'bold',
        fontSize: 16 - level,
    },
    summaryText: {
        fontSize: 14 - level,
        color: '#333'
    },
    content: {
        marginTop: 5,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        marginTop: 5
    },
    detailText: {
        width: '48%',
        fontSize: 13,
        marginVertical: 2
    }
});

export default ConsumptionReportScreen;
