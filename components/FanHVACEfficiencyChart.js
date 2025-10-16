import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryTheme } from 'victory';
import { useThermostat } from "../context/ThermostatContext";
import { useAuth } from '../context/AuthContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from "../styles/commonStyles";
import withExport from './withExport';

const Logger = require('./Logger');

const FanHVACEfficiencyChart = ({ thermostatIp, isDarkMode, parentComponent = null, onDataChange }) => {
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const { getFanVsHvacDaily } = useThermostat();
    const [chartData, setChartData] = useState([]);
    const [dayLimit, setDayLimit] = useState(14);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const json = await getFanVsHvacDaily(thermostatIp, hostname, dayLimit, token);
                if (Array.isArray(json)) {
                    const data = [];

                    json.forEach((d, index) => {
                        const label = new Date(d.run_date).toLocaleDateString();
                        data.push(
                            { x: label, y: d.hvac_runtime_hr, category: 'HVAC' },
                            { x: label, y: d.fan_runtime_hr, category: 'Fan' }
                        );
                    });

                    setChartData(data);
                    if (onDataChange) {
                        onDataChange(data);
                    }
                } else {
                    throw new Error(json.error || 'Failed to fetch fan vs hvac data');
                }
            } catch (error) {
                Logger.error(`Error fetching fan vs hvac data: ${error.message}`, 'FanHVACEfficiencyChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, dayLimit, token]);

    const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;

    return (
        <View style={styles.container}>
            <Text style={subHeaderStyle}>Fan vs. HVAC Daily Runtime (hours)</Text>
            <Picker
                selectedValue={dayLimit}
                style={styles.picker}
                onValueChange={(value) => setDayLimit(value)}
            >
                {[7, 14, 21, 30].map((val) => (
                    <Picker.Item key={val} label={`${val} days`} value={val} />
                ))}
            </Picker>
            {chartData.length > 0 ? (
                <VictoryChart
                    theme={VictoryTheme.material}
                    domainPadding={{ x: 20 }}
                    width={chartWidth}
                    height={chartHeight}
                >
                    <VictoryAxis
                        style={{
                            tickLabels: { fontSize: 12, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, angle: 30, padding: 5, fill: chartColors.colorBarFn(0.8) },
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
                        data={chartData}
                        x="x"
                        y="y"
                        style={{
                            data: {
                                fill: ({ datum }) =>
                                    datum.category === 'HVAC'
                                        ? chartColors.colorBarHVACFn(0.6)
                                        : chartColors.colorBarFanFn(0.3),
                                stroke: chartColors.colorBarFn(0.9),
                                strokeWidth: 1
                            }
                        }}
                        barWidth={8}
                        barRatio={0.8}
                        cornerRadius={2}
                        labels={({ datum }) => `${datum.category}: ${datum.y.toFixed(1)}h`}
                    />
                </VictoryChart>
            ) : (
                <Text style={subHeaderStyle}>No fan vs. HVAC data available.</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
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
        marginBottom: 10,
    },
});

const FanHVACEfficiencyChartWithExport = withExport(FanHVACEfficiencyChart);

export default (props) => {
    const [data, setData] = useState([]);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fileName = `thermostat_${props.thermostatIp}_${dateStr}_${hour}${minute}_fan_hvac_efficiency.csv`;

    return <FanHVACEfficiencyChartWithExport {...props} data={data} fileName={fileName} onDataChange={setData} />;
};