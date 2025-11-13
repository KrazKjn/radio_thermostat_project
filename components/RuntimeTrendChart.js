import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { VictoryChart, VictoryBar, VictoryAxis, VictoryTheme, VictoryTooltip } from 'victory';
import { Picker } from '@react-native-picker/picker';
import { useThermostat } from '../context/ThermostatContext';
import { HostnameContext } from '../context/HostnameContext';
import { getChartColors } from './chartTheme';
import { HVAC_MODE_HEAT, HVAC_MODE_COOL } from '../constants/hvac_mode';
import commonStyles from '../styles/commonStyles';
import withExport from './withExport';
import {
    costPerKwH,
    costPerGallon,
    hvacUsageDecimals,
    hvacCostDecimals,
    fanUsageDecimals,
    fanCostDecimals,
    calculateKwHsUsed,
    calculateCoolingCost,
    calculateGallonsConsumed,
    calculateHeatingCost,
    calculateFanKwHsUsed,
    calculateFanCost,
    formatMetric
} from '../utils/costing';

const Logger = require('./Logger');

const mapDailyData = (dailyJson, hvac_system) => {
  return dailyJson
    .filter(d => (d.HVAC?.tmode === HVAC_MODE_HEAT || d.HVAC?.tmode === HVAC_MODE_COOL) && d.HVAC.total_runtime_minutes <= 1440)
    .map(d => {
      const hvac = d.HVAC;
      const fan = d.FAN;

      const isCooling = hvac.tmode === HVAC_MODE_COOL;
      const modeLabel = isCooling ? 'Cooling' : 'Heating';
      const fillColor = isCooling ? 'blue' : 'red';

      const cost_per_unit = d.cost || (isCooling ? costPerKwH : costPerGallon);
      const cost = isCooling
        ? calculateCoolingCost(hvac.total_runtime_minutes, hvac_system, cost_per_unit)
        : calculateHeatingCost(hvac.total_runtime_minutes, hvac_system, cost_per_unit);

      const consumption = isCooling
        ? `${calculateKwHsUsed(hvac.total_runtime_minutes, hvac_system).toFixed(hvacUsageDecimals)} kWh`
        : `${calculateGallonsConsumed(hvac.total_runtime_minutes, hvac_system).toFixed(hvacUsageDecimals)} Gallons`;

      const fan_cost = fan
        ? calculateFanCost(fan.total_runtime_minutes, hvac_system, costPerKwH)
        : 0;

      const fan_consumption = fan
        ? `${calculateFanKwHsUsed(fan.total_runtime_minutes, hvac_system).toFixed(fanUsageDecimals)} kWh`
        : '0 kWh';

      return {
        x: new Date(`${d.run_date} 12:00:00`).toLocaleDateString('en-US', {
          weekday: 'short',
          month: '2-digit',
          day: '2-digit'
        }),
        y: hvac.total_runtime_minutes,
        mode: modeLabel,
        fill: fillColor,
        label: `${modeLabel}
          ${hvac.total_runtime_minutes.toFixed(1)} minutes
          ${(hvac.total_runtime_minutes / 60).toFixed(1)} hours
          $${(cost + fan_cost).toFixed(hvacCostDecimals)} Total Cost
          $${cost.toFixed(hvacCostDecimals)} / (${consumption})
          $${fan_cost.toFixed(fanCostDecimals)} Fan / (${fan_consumption})
          Temps: In ${formatMetric(hvac.avg_indoor_temp, ' F')}, Out ${formatMetric(hvac.avg_outdoor_temp, ' F')}
          Humidity: In ${formatMetric(hvac.avg_indoor_humidity, '%')}, Out ${formatMetric(hvac.avg_outdoor_humidity, '%')}`
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
    .filter(d => (d.HVAC.tmode === HVAC_MODE_HEAT|| d.HVAC.tmode === HVAC_MODE_COOL) && d.HVAC.total_runtime_minutes <= 60 )
    .map(d => {
      const iso = d.segment_hour.replace(' ', 'T') + 'Z';
      const dt = new Date(iso);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      let hh = dt.getHours();
      const period = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      const hhStr = String(hh).padStart(2, '0');

      const isCooling = d.HVAC.tmode === HVAC_MODE_COOL;
      const modeLabel = isCooling ? 'Cooling' : 'Heating';
      const fillColor = isCooling ? 'blue' : 'red';

      const cost_per_unit = d.cost || (isCooling ? costPerKwH : costPerGallon);
      const cost = isCooling
        ? calculateCoolingCost(d.HVAC.total_runtime_minutes, hvac_system, cost_per_unit)
        : calculateHeatingCost(d.HVAC.total_runtime_minutes, hvac_system, cost_per_unit);

      const consumption = isCooling
        ? `${calculateKwHsUsed(d.HVAC.total_runtime_minutes, hvac_system).toFixed(hvacUsageDecimals)} kWh`
        : `${calculateGallonsConsumed(d.HVAC.total_runtime_minutes, hvac_system).toFixed(hvacUsageDecimals)} Gallons`;

      // Merge fan data if present
      const fan_runtime_minutes = d.FAN ? d.FAN.total_runtime_minutes : 0;
      const fan_cost = d.FAN ? calculateFanCost(fan_runtime_minutes, hvac_system, cost_per_unit) : 0;
      const fan_consumption = d.FAN
        ? `${calculateFanKwHsUsed(fan_runtime_minutes, hvac_system).toFixed(fanUsageDecimals)} kWh`
        : '0 kWh';

      return {
        x: `${mm}/${dd} ${hhStr} ${period}`,
        y: d.HVAC.total_runtime_minutes,
        mode: modeLabel,
        fill: fillColor,
        label: `${modeLabel}
          ${d.HVAC.total_runtime_minutes.toFixed(1)} minutes
          ${(d.HVAC.total_runtime_minutes / 60).toFixed(2)} hours
          $${(cost + fan_cost).toFixed(hvacCostDecimals)} Total Cost
          $${cost.toFixed(hvacCostDecimals)} / ${consumption}
          $${fan_cost.toFixed(fanCostDecimals)} Fan / ${fan_consumption}
          Temps: In ${formatMetric(d.HVAC.avg_indoor_temp, ' F')}, Out ${formatMetric(d.HVAC.avg_outdoor_temp, ' F')}
          Humidity: In ${formatMetric(d.HVAC.avg_indoor_humidity, '%')}, Out ${formatMetric(d.HVAC.avg_outdoor_humidity, '%')}`
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
                        onValueChange={(value) => setDayLimit(Number(value))}
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
                        onValueChange={(value) => setHourLimit(Number(value))}
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