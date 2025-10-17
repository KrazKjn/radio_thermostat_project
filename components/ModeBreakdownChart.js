import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { PieChart } from 'react-native-chart-kit';
import { useThermostat } from "../context/ThermostatContext";
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from "../styles/commonStyles";
import { HVAC_MODE_HEAT, HVAC_MODE_COOL } from '../constants/hvac_mode';
import withExport from './withExport';

const Logger = require('./Logger');

const ModeBreakdownChart = ({ thermostatIp, isDarkMode, parentComponent = null, onDataChange }) => {
    const hostname = React.useContext(HostnameContext);
    const { getDailyModeRuntime } = useThermostat();
    const [chartData, setChartData] = useState([]);
    const [dayLimit, setDayLimit] = useState(14);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const json = await getDailyModeRuntime(thermostatIp, hostname, dayLimit);
                if (json) {
                    const heatRuntime = Math.round(json.filter(d => d.tmode === HVAC_MODE_HEAT).reduce((acc, cur) => acc + cur.total_runtime_hr, 0) * 100) / 100;
                    const coolRuntime = Math.round(json.filter(d => d.tmode === HVAC_MODE_COOL).reduce((acc, cur) => acc + cur.total_runtime_hr, 0) * 100) / 100;

                    const data = [
                        { name: `minutes Heating (${formatValue(heatRuntime / 60)} Hours)`, population: heatRuntime, color: 'rgba(255, 0, 0, 0.5)', legendFontFamily: 'Roboto', legendFontSize: 14, legendFontColor: '#7F7F7F', legendFontSize: 15 },
                        { name: `minutes Cooling (${formatValue(coolRuntime / 60)} Hours)`, population: coolRuntime, color: 'rgba(0, 0, 255, 0.5)', legendFontFamily: 'Roboto', legendFontSize: 14, legendFontColor: '#7F7F7F', legendFontSize: 15 },
                    ];
                    setChartData(data);
                    if (onDataChange) {
                        onDataChange(data);
                    }
                } else {
                    throw new Error(json.error || 'Failed to fetch mode breakdown data');
                }
            } catch (error) {
                Logger.error(`Error fetching mode breakdown data: ${error.message}`, 'ModeBreakdownChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, dayLimit]);

    const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;

    const chartConfig = {
        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    };

    function formatValue(value) {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        });
    }

    return (
        <View style={styles.container}>
            <Text style={subHeaderStyle}>Heating vs. Cooling Runtime</Text>
            <Picker
                selectedValue={dayLimit}
                style={styles.picker}
                onValueChange={(value) => setDayLimit(value)}
            >
                {[7, 14, 21, 30].map((val) => (
                    <Picker.Item key={val} label={`${val} days`} value={val} />
                ))}
            </Picker>
            {chartData.length > 0 && (chartData[0].population > 0 || chartData[1].population > 0) ? (
                <PieChart
                    data={chartData}
                    width={chartWidth}
                    height={chartHeight}
                    chartConfig={chartConfig}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    absolute
                />
            ) : (
                <Text style={subHeaderStyle}>No mode breakdown data available.</Text>
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
    },
});

const ModeBreakdownChartWithExport = withExport(ModeBreakdownChart);

export default (props) => {
    const [data, setData] = useState([]);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fileName = `thermostat_${props.thermostatIp}_${dateStr}_${hour}${minute}_mode_breakdown.csv`;

    return <ModeBreakdownChartWithExport {...props} data={data} fileName={fileName} onDataChange={setData} />;
};