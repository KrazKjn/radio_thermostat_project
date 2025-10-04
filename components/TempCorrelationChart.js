import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { VictoryChart, VictoryScatter, VictoryAxis, VictoryTheme } from 'victory';
import { useThermostat } from "../context/ThermostatContext";
import { useAuth } from '../context/AuthContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from "../styles/commonStyles";

const Logger = require('./Logger');

const TempCorrelationChart = ({ thermostatIp, isDarkMode, parentComponent = null }) => {
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const { getTempVsRuntime } = useThermostat();
    const [chartData, setChartData] = useState([]);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const json = await getTempVsRuntime(thermostatIp, hostname, token);
                if (json) {
                    const data = json.map(d => ({
                        x: d.avg_target_temp,
                        y: d.compressor_minutes,
                    }));
                    setChartData(data);
                } else {
                    throw new Error(json.error || 'Failed to fetch temperature correlation data');
                }
            } catch (error) {
                Logger.error(`Error fetching temp correlation data: ${error.message}`, 'TempCorrelationChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, token]);

    const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;

    return (
        <View style={styles.container}>
            <Text style={subHeaderStyle}>Temperature vs. Runtime</Text>
            {chartData.length > 0 ? (
                <VictoryChart
                    theme={VictoryTheme.material}
                    domainPadding={10}
                    width={chartWidth}
                    height={chartHeight}
                >
                    <VictoryAxis
                        label="Target Temp (°F)"
                        style={{
                            axisLabel: { padding: 30, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) },
                            tickLabels: { fontSize: 12, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) }
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        label="Compressor Runtime (min)"
                        style={{
                            axisLabel: { padding: 40, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) },
                            tickLabels: { fontSize: 12, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) }
                        }}
                    />
                    <VictoryScatter
                        data={chartData}
                        size={4}
                        style={{
                            data: {
                                fill: chartColors.colorBarFn(0.6),
                                stroke: chartColors.colorBarFn(0.9),
                                strokeWidth: 1
                            }
                        }}
                    />
                </VictoryChart>
            ) : (
                <Text style={subHeaderStyle}>Loading correlation data...</Text>
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
});

export default TempCorrelationChart;
