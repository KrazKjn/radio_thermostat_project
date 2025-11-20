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
    const isValidEntry = d =>
        (d.HVAC?.tmode === HVAC_MODE_HEAT || d.HVAC?.tmode === HVAC_MODE_COOL || d.FAN) &&
        d.HVAC?.total_runtime_minutes <= 1440 &&
        d.FAN?.total_runtime_minutes <= 1440;

    return dailyJson.filter(isValidEntry).map(d => {
      const hvac = d.HVAC;
      const fan = d.FAN;

      const isCooling = hvac && hvac.tmode === HVAC_MODE_COOL;
      const modeLabel = hvac ? (isCooling ? 'Cooling' : 'Heating') : 'Circulation';
      const fillColor = hvac ? (isCooling ? 'blue' : 'red') : 'gray';
      const hvacMinutes = hvac?.total_runtime_minutes ?? (fan?.total_runtime_minutes ?? 0);

      const cost_per_unit = d.cost || (isCooling ? costPerKwH : costPerGallon);
      const cost = hvac ? (isCooling
        ? calculateCoolingCost(hvacMinutes, hvac_system, cost_per_unit)
        : calculateHeatingCost(hvacMinutes, hvac_system, cost_per_unit)) : 0;

      const consumption = hvac ? (isCooling
        ? `${calculateKwHsUsed(hvacMinutes, hvac_system).toFixed(hvacUsageDecimals)} kWh`
        : `${calculateGallonsConsumed(hvacMinutes, hvac_system).toFixed(hvacUsageDecimals)} Gallons`) : 'N/A';

      const fan_cost = fan
        ? calculateFanCost(fan.total_runtime_minutes, hvac_system, d.fan_cost || costPerKwH)
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
        y: hvacMinutes,
        mode: modeLabel,
        fill: fillColor,
        label: `${modeLabel}
          ${(hvacMinutes).toFixed(1)} minutes
          ${(hvacMinutes / 60).toFixed(1)} hours
          $${(cost + fan_cost).toFixed(hvacCostDecimals)} Total Cost
          $${cost.toFixed(hvacCostDecimals)} / (${consumption})
          $${fan_cost.toFixed(fanCostDecimals)} Fan / (${fan_consumption})
          Temps: In ${formatMetric(hvac ? hvac.avg_indoor_temp : 0, ' F')}, Out ${formatMetric(hvac ? hvac.avg_outdoor_temp : 0, ' F')}
          Humidity: In ${formatMetric(hvac ? hvac.avg_indoor_humidity : 0, '%')}, Out ${formatMetric(hvac ? hvac.avg_outdoor_humidity : 0, '%')}`
      };
    });
};

const mapHourlyData = (hourlyJson, hvac_system) => {
  return Object.values(hourlyJson)
    .filter(d => {
      const hvacValid = d.HVAC?.total_runtime_minutes > 0 && d.HVAC?.total_runtime_minutes <= 120;
      const fanValid = d.FAN?.total_runtime_minutes > 0 && d.FAN?.total_runtime_minutes <= 120;
      return (
        (d.HVAC && (d.HVAC.tmode === HVAC_MODE_HEAT || d.HVAC.tmode === HVAC_MODE_COOL) && hvacValid) ||
        (!hvacValid && d.FAN && fanValid)
      );
    })
    .map(d => {
      const iso = d.segment_hour.replace(' ', 'T') + 'Z';
      const dt = new Date(iso);
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      let hh = dt.getHours();
      const period = hh >= 12 ? 'PM' : 'AM';
      hh = hh % 12 || 12;
      const hhStr = String(hh).padStart(2, '0');

      const hvac = d.HVAC;
      const fan = d.FAN;

      const isCooling = hvac?.tmode === HVAC_MODE_COOL;
      const isHeating = hvac?.tmode === HVAC_MODE_HEAT;
      const isCirculation = fan && (!hvac || hvac.total_runtime_minutes === 0);

      const modeLabel = isCooling ? 'Cooling' : isHeating ? 'Heating' : 'Circulation';
      const fillColor = isCooling ? 'blue' : isHeating ? 'red' : 'gray';

      const hvacMinutes = hvac?.total_runtime_minutes ?? 0;
      const fanMinutes = fan?.total_runtime_minutes ?? 0;

      const cost_per_unit = d.cost || (isCooling ? costPerKwH : costPerGallon);
      const hvacCost = isCooling
        ? calculateCoolingCost(hvacMinutes, hvac_system, cost_per_unit)
        : isHeating
        ? calculateHeatingCost(hvacMinutes, hvac_system, cost_per_unit)
        : 0;

      const hvacConsumption = isCooling
        ? `${calculateKwHsUsed(hvacMinutes, hvac_system).toFixed(hvacUsageDecimals)} kWh`
        : isHeating
        ? `${calculateGallonsConsumed(hvacMinutes, hvac_system).toFixed(hvacUsageDecimals)} Gallons`
        : 'N/A';

      const fanCost = fan ? calculateFanCost(fanMinutes, hvac_system, costPerKwH) : 0;
      const fanConsumption = fan
        ? `${calculateFanKwHsUsed(fanMinutes, hvac_system).toFixed(fanUsageDecimals)} kWh`
        : '0 kWh';

      const displayMinutes = isCirculation ? fanMinutes : hvacMinutes;
      return {
        x: `${mm}/${dd} ${hhStr} ${period}`,
        y: displayMinutes,
        mode: modeLabel,
        fill: fillColor,
        label: `${modeLabel}
          ${displayMinutes.toFixed(1)} minutes
          ${(displayMinutes / 60).toFixed(2)} hours
          $${(hvacCost + fanCost).toFixed(hvacCostDecimals)} Total Cost
          $${hvacCost.toFixed(hvacCostDecimals)} / ${hvacConsumption}
          $${fanCost.toFixed(fanCostDecimals)} Fan / ${fanConsumption}
          Temps: In ${formatMetric(hvac?.avg_indoor_temp ?? 0, ' F')}, Out ${formatMetric(hvac?.avg_outdoor_temp ?? 0, ' F')}
          Humidity: In ${formatMetric(hvac?.avg_indoor_humidity ?? 0, '%')}, Out ${formatMetric(hvac?.avg_outdoor_humidity ?? 0, '%')}`
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