import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryTheme, VictoryTooltip } from 'victory';
import { Picker } from '@react-native-picker/picker';
import { useThermostat } from '../context/ThermostatContext';
import { useAuth } from '../context/AuthContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from '../styles/commonStyles';

const Logger = require('./Logger');

const parseVoltage = (voltageStr) => {
    if (!voltageStr) return 230;
    if (voltageStr.includes('/')) {
        const parts = voltageStr.split('/').map(v => parseFloat(v));
        return Math.max(...parts);
    }
    return parseFloat(voltageStr);
};

const calculateKwHDraw = (rla, voltage) =>
    rla ? (rla * voltage) / 1000 : 3.5;

const mapDailyData = (dailyJson, costPerKwH, KwHDraw) =>
    dailyJson.map(d => {
    const cost = ((d.total_runtime_hr / 60) * costPerKwH * KwHDraw) || 0;
    return {
        x: new Date(d.run_date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: '2-digit',
            day: '2-digit'
        }),
        y: d.total_runtime_hr,
        label: `${d.total_runtime_hr.toFixed(1)} minutes\n$${cost.toFixed(2)}`
    };
  });

const mapHourlyData = (hourlyJson, costPerKwH, KwHDraw) =>
    hourlyJson.map(d => {
    const iso = d.segment_hour.replace(' ', 'T') + 'Z';
    const dt = new Date(iso);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    let hh = dt.getHours();
    const period = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    const hhStr = String(hh).padStart(2, '0');
    const cost = ((d.total_runtime_minutes / 60) * costPerKwH * KwHDraw) || 0;

    return {
        x: `${mm}/${dd} ${hhStr} ${period}`,
        y: d.total_runtime_minutes / 60.0,
        label: `${d.total_runtime_minutes.toFixed(1)} minutes\n$${cost.toFixed(2)}`
    };
});

const RuntimeTrendChart = ({ thermostatIp, isDarkMode, parentComponent = null }) => {
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const { getThermostats, getDailyRuntime, getHourlyRuntime } = useThermostat();
    const [dailyData, setDailyData] = useState([]);
    const [hourlyData, setHourlyData] = useState([]);
    const [viewMode, setViewMode] = useState('daily');
    const [dayLimit, setDayLimit] = useState(14);
    const [hourLimit, setHourLimit] = useState(48);
    const [thermostats, setThermostats] = useState([]);
      const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;
    const costPerKwH = 0.126398563

    useEffect(() => {
        const fetchData = async () => {
            try {
                const definedThermostats = await getThermostats(hostname, token);
                setThermostats(definedThermostats || []);

                const thermostat = definedThermostats?.find(t => t.ip === thermostatIp);
                const voltage = parseVoltage(thermostat?.voltage);
                const KwHDraw = calculateKwHDraw(thermostat?.rla, voltage);

                const [dailyJson, hourlyJson] = await Promise.all([
                    getDailyRuntime(thermostatIp, hostname, dayLimit, token),
                    getHourlyRuntime(thermostatIp, hostname, hourLimit, token)
                ]);

                if (Array.isArray(dailyJson)) {
                    setDailyData(mapDailyData(dailyJson, costPerKwH, KwHDraw));
                } else {
                    throw new Error(dailyJson.error || 'Failed to fetch daily runtime');
                }

                if (Array.isArray(hourlyJson)) {
                    setHourlyData(mapHourlyData(hourlyJson, costPerKwH, KwHDraw));
                } else {
                    throw new Error(hourlyJson.error || 'Failed to fetch hourly runtime');
                }
            } catch (error) {
                Logger.error(`Error fetching runtime data: ${error.message}`, 'RuntimeTrendChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, dayLimit, hourLimit, token, costPerKwH]);
    
    const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;

    const renderChart = (data, label, axisLabel) => (
        <>
            <Text style={subHeaderStyle}>{label}</Text>
            <VictoryChart
                theme={VictoryTheme.material}
                domainPadding={{ x: 10 }}
                width={chartWidth}
                height={chartHeight}
            >
                <VictoryAxis
                    label={axisLabel}
                    style={{
                        tickLabels: { fontSize: 12, angle: 30, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, padding: 5, fill: chartColors.colorBarFn(0.8) },
                        axisLabel: { fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, padding: 30 }
                    }}
                />
                <VictoryAxis
                    dependentAxis
                    label="Runtime (hrs)"
                    style={{
                        tickLabels: { fontSize: 12, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) },
                        axisLabel: { fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, padding: 40 }
                    }}
                />
                <VictoryBar
                    data={data}
                    style={{
                        data: {
                            fill: chartColors.colorBarFn(0.6),
                            stroke: chartColors.colorBarFn(0.9),
                            strokeWidth: 1
                        }
                    }}
                    barRatio={0.8}
                    labels={({ datum }) => datum.label}
                    labelComponent={<VictoryTooltip />}
                />
            </VictoryChart>
        </>
    );

    return (
        <View style={styles.container}>
            <View style={styles.toggleContainer}>
                <TouchableOpacity onPress={() => setViewMode('daily')} style={[styles.toggleButton, viewMode === 'daily' && styles.activeButton]}>
                    <Text style={styles.toggleText}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setViewMode('hourly')} style={[styles.toggleButton, viewMode === 'hourly' && styles.activeButton]}>
                    <Text style={styles.toggleText}>Hourly</Text>
                </TouchableOpacity>
            </View>

            {viewMode === 'daily' && (
                <>
                    <Picker
                        selectedValue={dayLimit}
                        style={styles.picker}
                        onValueChange={(value) => setDayLimit(value)}
                    >
                        {[7, 14, 21, 30].map((val) => (
                            <Picker.Item key={val} label={`${val} days`} value={val} />
                        ))}
                    </Picker>
                    {dailyData.length > 0 ? renderChart(dailyData, 'Daily Runtime (minutes)', 'Day') : <Text style={subHeaderStyle}>Loading daily data...</Text>}
                </>
            )}

            {viewMode === 'hourly' && (
                <>
                    <Picker
                        selectedValue={hourLimit}
                        style={styles.picker}
                        onValueChange={(value) => setHourLimit(value)}
                    >
                        {[24, 48, 72, 96].map((val) => (
                            <Picker.Item key={val} label={`${val} hours`} value={val} />
                        ))}
                    </Picker>
                    {hourlyData.length > 0 ? renderChart(hourlyData, 'Hourly Runtime (hours)', 'Day and Hour') : <Text style={subHeaderStyle}>Loading hourly data...</Text>}
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
    },
    toggleContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 10,
    },
    toggleButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: '#f0f0f0',
        borderWidth: 1,
        borderColor: '#ccc',
    },
    activeButton: {
        backgroundColor: '#007BFF',
        borderColor: '#007BFF',
    },
    toggleText: {
        color: '#333',
    },
    subHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    picker: {
        height: 40,
        width: 150,
        color: '#333',
        backgroundColor: '#f0f0f0',
        borderRadius: 5,
        alignSelf: 'center',
    },
});

export default RuntimeTrendChart;
