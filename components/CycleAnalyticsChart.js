import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryGroup, VictoryTheme, VictoryTooltip } from 'victory';
import { Picker } from '@react-native-picker/picker';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from '../styles/commonStyles';
import withExport from './withExport';

const Logger = require('./Logger');

const formatMetric = (value, unit) =>
  value != null ? `${value.toFixed(1)}${unit}` : '--';

const CycleAnalyticsChart = ({ thermostatIp, isDarkMode, parentComponent = null, onDataChange, viewMode }) => {
  const hostname = React.useContext(HostnameContext);
  const { getThermostats, getDailyCycles, getHourlyCycles } = useThermostat();
  const [dailyData, setDailyData] = useState([]);
  const [hourlyData, setHourlyData] = useState([]);
  const [dayLimit, setDayLimit] = useState(7);
  const [hourLimit, setHourLimit] = useState(24);
  const [thermostats, setThermostats] = useState([]);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const chartColors = getChartColors(isDarkMode);
  const chartWidth = windowWidth - 40;
  const chartHeight = windowHeight / 2;
  const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;
  const costPerKwH = 0.126398563
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const daily = await getDailyCycles(thermostatIp, hostname, dayLimit);
        const hourly = await getHourlyCycles(thermostatIp, hostname, hourLimit);
        const definedThermostats = await getThermostats(hostname);
        setDailyData(daily);
        setHourlyData(hourly);
        setThermostats(definedThermostats || []);
        if (onDataChange) {
            if (viewMode === 'daily') {
                onDataChange(daily);
            } else {
                onDataChange(hourly);
            }
        }
      } catch (error) {
        Logger.error(`Error fetching cycle analytics: ${error.message}`, 'CycleAnalyticsChart', 'fetchData');
      }
    };
    fetchData();
  }, [thermostatIp, hostname, dayLimit, hourLimit, viewMode]);

  const formatDailyData = dailyData.map(d => {
    const thermostat = thermostats.find(t => t.ip === thermostatIp);
    //  (RLA × Voltage) / 1000
    let voltage = 230; // default fallback
    if (thermostat?.voltage && thermostat.voltage.includes('/')) {
        const parts = thermostat.voltage.split('/').map(v => parseFloat(v));
        voltage = Math.max(...parts);
    } else if (thermostat?.voltage) {
        voltage = parseFloat(thermostat.voltage);
    }
    const KwHDraw = thermostat?.rla ? (thermostat.rla * voltage / 1000) : 3.5; // Example values
    const costPerDay = ((d.total_runtime_minutes / 60) * costPerKwH * KwHDraw) || 0; // Example cost model
    return {
        x: new Date(`${d.run_date} 12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' }),
        y: d.cycle_count,
        label: `${d.cycle_count} cycles
            ${parseFloat(d.total_runtime_minutes).toFixed(1)} minutes
            $${costPerDay.toFixed(2)} / day
            Temps: In ${formatMetric(d.avg_indoor_temp, ' F')}, Out ${formatMetric(d.avg_outdoor_temp, ' F')}
            Humidity: In ${formatMetric(d.avg_indoor_humidity, '%')}, Out ${formatMetric(d.avg_outdoor_humidity, '%')}`
    };
  });

  const formatHourlyData = hourlyData.map(d => {
    const dateStr = new Date(`${d.run_date} 12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: '2-digit', day: '2-digit' });
    const hour = parseInt(d.hour, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const label = `${dateStr} ${hour12} ${ampm}`;
    const thermostat = thermostats.find(t => t.ip === thermostatIp);
    //  (RLA × Voltage) / 1000
    let voltage = 230; // default fallback
    if (thermostat?.voltage && thermostat.voltage.includes('/')) {
        const parts = thermostat.voltage.split('/').map(v => parseFloat(v));
        voltage = Math.max(...parts);
    } else if (thermostat?.voltage) {
        voltage = parseFloat(thermostat.voltage);
    }
    const KwHDraw = thermostat?.rla ? (thermostat.rla * voltage / 1000) : 3.5; // Example values
    const costPerCycle = ((d.total_runtime_minutes / 60) * costPerKwH * KwHDraw) / d.cycle_count || 0; // Example cost model
    const wearIndex = d.cycle_count >= 6 ? '⚠️' : '';
    return {
        x: label,
        y: d.cycle_count,
        label: `${d.cycle_count} cycles
            ${parseFloat(d.total_runtime_minutes).toFixed(1)} minutes
            $${costPerCycle.toFixed(2)} / cycle ${wearIndex}
            Temps: In ${formatMetric(d.avg_indoor_temp, ' F')}, Out ${formatMetric(d.avg_outdoor_temp, ' F')}
            Humidity: In ${formatMetric(d.avg_indoor_humidity, '%')}, Out ${formatMetric(d.avg_outdoor_humidity, '%')}`
    };
  });

  return (
    <View style={styles.container}>
        <Text style={subHeaderStyle}>Cycle Analytics</Text>
        <Picker
            selectedValue={dayLimit}
            style={styles.picker}
            onValueChange={(value) => setDayLimit(value)}
        >
            {[7, 14, 21, 30].map((val) => (
                <Picker.Item key={val} label={`${val} days`} value={val} />
            ))}
        </Picker>

        <Text style={styles.sectionHeader}>Daily Cycle Count</Text>
        <VictoryChart
            theme={VictoryTheme.material}
            domainPadding={{ x: 20 }}
            width={chartWidth}
            height={chartHeight}
        >
            <VictoryAxis
                label="Days"
                style={
                    {
                        tickLabels: { angle: 30, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold', color: chartColors.colorBarFn(0.8) }, fill: chartColors.colorBarFn(0.8) }
                    }
                }
            />
            <VictoryAxis
                dependentAxis
                label="Cycles"
                style={
                    {
                        axisLabel: { padding: 30, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' } },
                        tickLabels: { fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' } }
                    }
                }
            />
            <VictoryBar
                data={formatDailyData}
                style={{ data: { fill: chartColors.colorBarFn(0.6) } }}
                labels={({ datum }) => datum.label}
                labelComponent={<VictoryTooltip />}
            />
        </VictoryChart>

        <Text style={styles.sectionHeader}>Hourly Breakdown</Text>
        <Picker
            selectedValue={hourLimit}
            style={styles.picker}
            onValueChange={(value) => setHourLimit(value)}
        >
            {[24, 48, 72, 96].map((val) => (
                <Picker.Item key={val} label={`${val} hours`} value={val} />
            ))}
        </Picker>
        <VictoryChart
            theme={VictoryTheme.material}
            domainPadding={{ x: 10 }}
            width={chartWidth}
            height={chartHeight}
        >
            <VictoryAxis
                label="Day & Hour"
                style={
                    {
                        tickLabels: { angle: 90, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' }, fill: chartColors.colorBarFn(0.8) }
                    }
                }
            />
            <VictoryAxis
                dependentAxis
                label="Cycles"
                style={
                    {
                        axisLabel: { padding: 30, fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' } },
                        tickLabels: { fontSize: 14, style:{ fontFamily: 'Roboto', fontWeight: 'bold' } }
                    }
                }
            />
            <VictoryBar
                data={formatHourlyData}
                style={{ data: { fill: chartColors.colorBarFn(0.3) } }}
                labels={({ datum }) => datum.label}
                labelComponent={<VictoryTooltip />}
            />
        </VictoryChart>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  subHeader: {
    color: "#aaa",
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionHeader: {
    color: "#aaa",
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
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

const CycleAnalyticsChartWithExport = withExport(CycleAnalyticsChart);

export default (props) => {
    const [data, setData] = useState([]);
    const [viewMode, setViewMode] = useState('daily');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fileName = `thermostat_${props.thermostatIp}_${dateStr}_${hour}${minute}_cycle_analytics_${viewMode}.csv`;

    return <CycleAnalyticsChartWithExport {...props} data={data} fileName={fileName} onDataChange={setData} viewMode={viewMode} />;
};