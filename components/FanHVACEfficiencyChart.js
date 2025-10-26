import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { VictoryGroup, VictoryChart, VictoryBar, VictoryAxis, VictoryTheme, VictoryTooltip } from 'victory';
import { useThermostat } from "../context/ThermostatContext";
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from "../styles/commonStyles";
import withExport from './withExport';

const Logger = require('./Logger');

const FanHVACEfficiencyChart = ({ thermostatIp, isDarkMode, parentComponent = null, onDataChange }) => {
    const hostname = React.useContext(HostnameContext);
    const { getFanVsHvacDaily } = useThermostat();
    const [chartData, setChartData] = useState({ hvacData: [], fanData: [] });
    const [dayLimit, setDayLimit] = useState(7);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const json = await getFanVsHvacDaily(thermostatIp, hostname, dayLimit);
                if (Array.isArray(json)) {
                    const hvacData = [];
                    const fanData = [];

                    json.forEach((d) => {
                        const label = new Date(d.run_date).toLocaleDateString();
                        hvacData.push({ x: label, y: d.hvac_runtime_hr });
                        fanData.push({ x: label, y: d.fan_runtime_hr });
                    });

                    setChartData({ hvacData, fanData });                    
                    if (onDataChange) {
                        onDataChange({ hvacData, fanData });
                    }
                } else {
                    throw new Error(json.error || 'Failed to fetch fan vs hvac data');
                }
            } catch (error) {
                Logger.error(`Error fetching fan vs hvac data: ${error.message}`, 'FanHVACEfficiencyChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, dayLimit]);

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
            {chartData.hvacData.length > 0 ? (
                <VictoryChart
                    theme={VictoryTheme.material}
                    domainPadding={{ x: 30 }}
                    width={chartWidth}
                    height={chartHeight}
                >
                    <VictoryAxis
                        style={{
                            tickLabels: {
                                fontSize: 12,
                                fontFamily: 'Roboto',
                                fontWeight: 'bold',
                                angle: 30,
                                padding: 5,
                                fill: chartColors.colorBarFn(0.8)
                            },
                            axisLabel: {
                                fontSize: 14,
                                fontFamily: 'Roboto',
                                fontWeight: 'bold',
                                padding: 30
                            }
                        }}
                    />
                    <VictoryAxis
                        dependentAxis
                        label="Runtime (hrs)"
                        style={{
                            tickLabels: {
                                fontSize: 12,
                                fontFamily: 'Roboto',
                                fontWeight: 'bold',
                                fill: chartColors.colorBarFn(0.8)
                            },
                            axisLabel: {
                                fontSize: 14,
                                fontFamily: 'Roboto',
                                fontWeight: 'bold',
                                padding: 40
                            }
                        }}
                    />
                    <VictoryGroup offset={12} colorScale={['#4db6ac', '#ffb74d']}>
                        <VictoryBar
                            data={chartData.hvacData}
                            labels={({ datum }) => `HVAC: ${datum.y.toFixed(1)}h`}
                            style={{
                                data: {
                                fill: chartColors.colorBarHVACFn(0.6),
                                stroke: chartColors.colorBarFn(0.9),
                                strokeWidth: 1
                                }
                            }}
                            labelComponent={
                                <VictoryTooltip
                                    flyoutStyle={{ fill: '#222', stroke: '#ccc', strokeWidth: 1 }}
                                    style={{ fill: '#FFFF00', fontSize: 12, fontFamily: 'Roboto' }}
                                    pointerLength={6}
                                    cornerRadius={4}
                                    flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                                />
                            }
                        />
                        <VictoryBar
                            data={chartData.fanData}
                            labels={({ datum }) => `Fan: ${datum.y.toFixed(1)}h`}
                            style={{
                                data: {
                                fill: chartColors.colorBarFanFn(0.3),
                                stroke: chartColors.colorBarFn(0.9),
                                strokeWidth: 1
                                }
                            }}
                            labelComponent={
                                <VictoryTooltip
                                    flyoutStyle={{ fill: '#222', stroke: '#ccc', strokeWidth: 1 }}
                                    style={{ fill: '#FFFF00', fontSize: 12, fontFamily: 'Roboto' }}
                                    pointerLength={6}
                                    cornerRadius={4}
                                    flyoutPadding={{ top: 6, bottom: 6, left: 10, right: 10 }}
                                />
                            }
                        />
                    </VictoryGroup>
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