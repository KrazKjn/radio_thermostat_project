import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryTheme, VictoryTooltip } from 'victory';
import { Picker } from '@react-native-picker/picker';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import commonStyles from '../styles/commonStyles';
import withExport from './withExport';

const Logger = require('./Logger');
const costPerKwH = 0.126398563
const costPerGallon = 2.85;

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

const calculateKwHsUsed = (runtimeMin, hvac_system) => {
  const voltage = parseVoltage(hvac_system?.voltage);
  const kwDraw = calculateKwHDraw(hvac_system?.rla, voltage);
  return (runtimeMin / 60) * kwDraw;
};

const calculateCoolingCost = (runtimeMin, hvac_system, costPerKwH = 0.126) => {
  const kwHsUsed = calculateKwHsUsed(runtimeMin, hvac_system);
  return kwHsUsed * costPerKwH;
};

const calculateGallonsConsumed = (runtimeMin, hvac_system, efficiency = 0.90) => {
  const heatingBTU =
    hvac_system?.btu_per_hr_high ||
    hvac_system?.btu_per_hr_low ||
    (hvac_system?.tons * 20000);

  const effectiveBTU = heatingBTU * efficiency;
  const gallonsPerMinute = (effectiveBTU / 91452) / 60;

  return runtimeMin * gallonsPerMinute;
};

const calculateHeatingCost = (runtimeMin, hvac_system, costPerGallon = 3.25, efficiency = 0.90) => {
  const gallonsUsed = calculateGallonsConsumed(runtimeMin, hvac_system, efficiency);
  return gallonsUsed * costPerGallon;
};

const calculateFanKwHDraw = (amps, voltage) =>
  amps && voltage ? (amps * voltage) / 1000 : 0.5;

const calculateFanKwHsUsed = (runtimeMin, hvac_system) => {
  const voltage = parseVoltage(hvac_system?.fan_voltage);
  const amps = hvac_system?.fan_rated_amps;
  const kwDraw = calculateFanKwHDraw(amps, voltage);
  return (runtimeMin / 60) * kwDraw;
};

const calculateFanCost = (runtimeMin, hvac_system, costPerKwH = 0.126) => {
  const kwHsUsed = calculateFanKwHsUsed(runtimeMin, hvac_system);
  return kwHsUsed * costPerKwH;
};

const formatMetric = (value, unit) =>
  value != null ? `${value.toFixed(1)}${unit}` : '--';

const mapDailyData = (dailyJson, hvac_system) => {
  const grouped = {};

  // First pass: group by run_date and tmode
  dailyJson.forEach(d => {
    const key = `${d.run_date}_${d.tmode}`;
    if (!grouped[key]) {
      grouped[key] = { ...d, fan_runtime_hr: 0 };
    } else {
      grouped[key].total_runtime_hr += d.total_runtime_hr;
    }

    // If it's fan-only, store separately by run_date
    if (d.tmode === 0) {
      const fanKey = `${d.run_date}_fan`;
      grouped[fanKey] = grouped[fanKey] || { ...d };
    }
  });

  // Second pass: map heating/cooling entries and merge fan data
  return Object.values(grouped)
    .filter(d => d.tmode === 1 || d.tmode === 2)
    .map(d => {
      const fanKey = `${d.run_date}_fan`;
      const fan = grouped[fanKey];

      const isCooling = d.tmode === 2;
      const modeLabel = isCooling ? 'Cooling' : 'Heating';
      const fillColor = isCooling ? 'blue' : 'red';

      const cost = isCooling
        ? calculateCoolingCost(d.total_runtime_hr, hvac_system, costPerKwH)
        : calculateHeatingCost(d.total_runtime_hr, hvac_system, costPerGallon);

      const consumption = isCooling
        ? `${calculateKwHsUsed(d.total_runtime_hr, hvac_system).toFixed(2)} kWh`
        : `${calculateGallonsConsumed(d.total_runtime_hr, hvac_system).toFixed(2)} Gallons`;

      const fan_cost = fan
        ? calculateFanCost(fan.total_runtime_hr, hvac_system, costPerKwH)
        : 0;

      const fan_consumption = fan
        ? `${calculateFanKwHsUsed(fan.total_runtime_hr, hvac_system).toFixed(2)} kWh`
        : '0 kWh';

      return {
        x: new Date(`${d.run_date} 12:00:00`).toLocaleDateString('en-US', {
          weekday: 'short',
          month: '2-digit',
          day: '2-digit'
        }),
        y: d.total_runtime_hr,
        tmode: d.tmode,
        fill: fillColor,
        label: `${modeLabel}
          ${d.total_runtime_hr.toFixed(1)} minutes
          ${(d.total_runtime_hr / 60).toFixed(1)} hours
          $${(cost + fan_cost).toFixed(2)} Total Cost
          $${cost.toFixed(2)} / (${consumption})
          $${fan_cost.toFixed(2)} Fan / (${fan_consumption})
          Temps: In ${formatMetric(d.avg_indoor_temp, ' F')}, Out ${formatMetric(d.avg_outdoor_temp, ' F')}
          Humidity: In ${formatMetric(d.avg_indoor_humidity, '%')}, Out ${formatMetric(d.avg_outdoor_humidity, '%')}`
      };
    });
};

const mapHourlyData = (hourlyJson, hvac_system) => {
  const grouped = {};

  // First pass: group by segment_hour and tmode
  hourlyJson.forEach(d => {
    if (d.HVAC && d.HVAC.tmode !== null && d.HVAC.tmode !== undefined) {
      const key = `${d.segment_hour}_${d.HVAC.tmode}`;
      grouped[key] = d;
    }
  });

  // Second pass: merge fan data into heating/cooling
  return Object.values(grouped)
    .filter(d => d.HVAC.tmode === 1 || d.HVAC.tmode === 2)
    .map(d => {
      const iso = d.segment_hour.replace(' ', 'T') + 'Z';
      const dt = new Date(iso);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      let hh = dt.getHours();
      const period = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      const hhStr = String(hh).padStart(2, '0');

      const isCooling = d.HVAC.tmode === 2;
      const modeLabel = isCooling ? 'Cooling' : 'Heating';
      const fillColor = isCooling ? 'blue' : 'red';

      const runtime_hr = d.HVAC.total_runtime_minutes / 60;
      const cost = isCooling
        ? calculateCoolingCost(runtime_hr, hvac_system, costPerKwH)
        : calculateHeatingCost(d.HVAC.total_runtime_minutes, hvac_system, costPerGallon);

      const consumption = isCooling
        ? `${calculateKwHsUsed(runtime_hr, hvac_system).toFixed(2)} kWh`
        : `${calculateGallonsConsumed(d.HVAC.total_runtime_minutes, hvac_system).toFixed(2)} Gallons`;

      // Merge fan data if present
      const fan_runtime_hr = d.FAN ? d.FAN.total_runtime_minutes / 60 : 0;
      const fan_cost = d.FAN ? calculateFanCost(fan_runtime_hr, hvac_system, costPerKwH) : 0;
      const fan_consumption = d.FAN
        ? `${calculateFanKwHsUsed(fan_runtime_hr, hvac_system).toFixed(3)} kWh`
        : '0 kWh';

      return {
        x: `${mm}/${dd} ${hhStr} ${period}`,
        y: runtime_hr,
        tmode: d.HVAC.tmode,
        fill: fillColor,
        label: `${modeLabel}
          ${d.HVAC.total_runtime_minutes.toFixed(1)} minutes
          ${runtime_hr.toFixed(2)} hours
          $${(cost + fan_cost).toFixed(2)} Total Cost
          $${cost.toFixed(2)} / ${consumption}
          $${fan_cost.toFixed(3)} Fan / ${fan_consumption}
          Temps: Indoor ${formatMetric(d.HVAC.avg_indoor_temp, ' F')}, Outdoor ${formatMetric(d.HVAC.avg_outdoor_temp, ' F')}
          Humidity: Indoor ${formatMetric(d.HVAC.avg_indoor_humidity, '%')}, Outdoor ${formatMetric(d.HVAC.avg_outdoor_humidity, '%')}`
      };
    });
};

const RuntimeTrendChart = ({ thermostatIp, isDarkMode, parentComponent = null, onDataChange }) => {
    const hostname = React.useContext(HostnameContext);
    const { getThermostats, getDailyRuntime, getHourlyRuntime } = useThermostat();
    const [dailyData, setDailyData] = useState(null);
    const [hourlyData, setHourlyData] = useState(null);
    const [viewMode, setViewMode] = useState('daily');
    const [dayLimit, setDayLimit] = useState(7);
    const [hourLimit, setHourLimit] = useState(24);
    const [thermostats, setThermostats] = useState([]);
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const chartColors = getChartColors(isDarkMode);
    const chartWidth = windowWidth - 40;
    const chartHeight = windowHeight / 2;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const definedThermostats = await getThermostats(hostname);
                setThermostats(definedThermostats || []);

                const thermostat = definedThermostats?.find(t => t.ip === thermostatIp);

                const [dailyJson, hourlyJson] = await Promise.all([
                    getDailyRuntime(thermostatIp, hostname, dayLimit),
                    getHourlyRuntime(thermostatIp, hostname, hourLimit)
                ]);

                if (Array.isArray(dailyJson)) {
                    const mappedDailyData = mapDailyData(dailyJson, thermostat);
                    setDailyData(mappedDailyData);
                    if (viewMode === 'daily' && onDataChange) {
                        onDataChange(mappedDailyData);
                    }
                } else {
                    throw new Error(dailyJson.error || 'Failed to fetch daily runtime');
                }

                if (Array.isArray(hourlyJson)) {
                    const mappedHourlyData = mapHourlyData(hourlyJson, thermostat);
                    setHourlyData(mappedHourlyData);
                    if (viewMode === 'hourly' && onDataChange) {
                        onDataChange(mappedHourlyData);
                    }
                } else {
                    throw new Error(hourlyJson.error || 'Failed to fetch hourly runtime');
                }
            } catch (error) {
                Logger.error(`Error fetching runtime data: ${error.message}`, 'RuntimeTrendChart', 'fetchData');
            }
        };

        fetchData();
    }, [thermostatIp, hostname, dayLimit, hourLimit, viewMode]);
    
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
                            // fill: chartColors.colorBarFn(0.6),
                             fill: ({ datum }) => datum.fill,
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
                    {dailyData ? 
                      (dailyData.length > 0 ? renderChart(dailyData, 'Daily Runtime (minutes)', 'Day') : 
                      <Text style={subHeaderStyle}>No daily data.</Text>) :
                      <Text style={subHeaderStyle}>Loading daily data...</Text>
                    }
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
                    {hourlyData ? 
                      (hourlyData.length > 0 ? renderChart(hourlyData, 'Hourly Runtime (hours)', 'Day and Hour') : 
                      <Text style={subHeaderStyle}>No hourly data.</Text>) :
                      <Text style={subHeaderStyle}>Loading hourly data...</Text>
                    }
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

const RuntimeTrendChartWithExport = withExport(RuntimeTrendChart);

export default (props) => {
    const [data, setData] = useState([]);
    const [viewMode, setViewMode] = useState('daily');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fileName = `thermostat_${props.thermostatIp}_${dateStr}_${hour}${minute}_runtime_${viewMode}.csv`;

    return <RuntimeTrendChartWithExport {...props} data={data} fileName={fileName} onDataChange={setData} />;
};