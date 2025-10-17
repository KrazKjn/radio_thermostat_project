import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Switch, TextInput, StyleSheet, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useThermostat } from "../context/ThermostatContext";
import { HostnameContext } from "../context/HostnameContext";
import commonStyles from "../styles/commonStyles";
import { HVAC_MODE_HEAT, HVAC_MODE_COOL } from '../constants/hvac_mode';
import DataRefreshContext from "../context/DataRefreshContext";
import { getChartColors } from './chartTheme';
import withExport from "./withExport";

const Logger = require('./Logger');

const LiveChart = ({ thermostatIp, parentComponent = null, isDarkMode: initialIsDarkMode, onDataChange }) => {
    const hostname = React.useContext(HostnameContext);
    const { register } = React.useContext(DataRefreshContext);
    const { fetchScannedData, getScannerStatus, startScanner, stopScanner, thermostats, updateThermostatState, formatTime, isTokenExpired } = useThermostat();
    const [dataPoints, setDataPoints] = useState([]);
    const [isScannerOn, setIsScannerOn] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(initialIsDarkMode);
    const [interval, setIntervalValue] = useState(1);
    const refreshTimerRef = useRef(null);
    const { width: windowWidth } = useWindowDimensions();
    const chartWidth = Math.max( (parentComponent !== null ? parentComponent.innerWidth - 150 : windowWidth - 40), 320);
    const chartColors = getChartColors(isDarkMode);

    const fetchData = async () => {
        try {
            const scannedData = await fetchScannedData(thermostatIp, hostname);
            let filteredData = scannedData.filter(entry => entry.temp !== 0);
            const tempData = filteredData.length > 1 && new Date(filteredData[0].lastUpdated) < new Date(filteredData[filteredData.length - 1].lastUpdated) ? filteredData : [...filteredData].reverse();
            setDataPoints(tempData);
            if (onDataChange) {
                onDataChange(tempData);
            }
        } catch (error) {
            console.error("Error fetching scanned data:", error);
        }
    };

    useEffect(() => {
        const checkScannerStatus = async () => {
            try {
                const status = await getScannerStatus(thermostatIp, hostname);
                if (status) {
                    setIsScannerOn(true);
                    setIntervalValue(Math.max(1, Math.round(status.interval / 60000)));
                    startRefreshTimer();
                } else {
                    handleToggleChange(true);
                }
            } catch (error) {
                console.error("Error checking scanner status:", error);
            }
        };

        checkScannerStatus();
    }, [thermostatIp, getScannerStatus]);

    useEffect(() => {
        fetchData();
        const unsubscribe = register(fetchData);
        return () => unsubscribe();
    }, [thermostatIp, register]);

    const handleToggleChange = async (value) => {
        setIsScannerOn(value);
        if (value) {
            try {
                startRefreshTimer();
                await startScanner(thermostatIp, hostname, interval * 60000);
            } catch (error) {
                console.error("Error starting scanner:", error);
            }
        } else {
            try {
                stopRefreshTimer();
                await stopScanner(thermostatIp, hostname);
            } catch (error) {
                console.error("Error stopping scanner:", error);
            }
        }
    };

    const handleIntervalChange = async (newInterval) => {
        const validatedInterval = Math.max(1, newInterval);
        setIntervalValue(validatedInterval);
        if (isScannerOn) {
            try {
                stopRefreshTimer();
                await stopScanner(thermostatIp, hostname);
                startRefreshTimer(validatedInterval * 60000);
                await startScanner(thermostatIp, hostname, validatedInterval * 60000);
            } catch (error) {
                console.error("Error updating scanner interval:", error);
            }
        }
    };

    const startRefreshTimer = (customInterval) => {
        const timerInterval = customInterval || interval * 60000;
        stopRefreshTimer();
        const timer = setInterval(async () => {
            try {
                const scannedData = await fetchScannedData(thermostatIp, hostname);
                if (scannedData.length > 0) {
                    const latestScan = {
                        currentTemp: scannedData[0].temp,
                        targetTemp: scannedData[0].tmode === HVAC_MODE_COOL ? scannedData[0].t_cool : scannedData[0].t_heat || null,
                        currentTempMode: scannedData[0].tmode,
                        currentFanMode: scannedData[0].fmode,
                        currentTempState: scannedData[0].tstate,
                        currentFanState: scannedData[0].fstate,
                        currentTime: scannedData[0].time,
                        formattedTime: scannedData[0].time ? formatTime(scannedData[0].time) : "Loading...",
                        override: scannedData[0].override,
                        hold: scannedData[0].hold,
                        outdoor_temp: scannedData[0].outdoor_temp,
                        cloud_cover: scannedData[0].cloud_cover,
                        outdoor_humidity: scannedData[0].outdoor_humidity,
                        humidity: scannedData[0].humidity,
                        lastUpdated: Date.now(),
                    };
                    const contextData = thermostats[thermostatIp] || {};
                    const fieldsToCheck = ["targetTemp", "currentTempMode", "currentFanMode", "currentTime", "formattedTime", "override", "hold", "outdoor_temp", "cloud_cover", "humidity", "ourdoor_humidity"];
                    const hasDifference = fieldsToCheck.some(key => latestScan[key] !== contextData[key]);
                    if (hasDifference) {
                        updateThermostatState(thermostatIp, latestScan);
                    }
                    const tempData = scannedData.length > 1 && new Date(scannedData[0].lastUpdated) < new Date(scannedData[scannedData.length - 1].lastUpdated) ? scannedData : [...scannedData].reverse();
                    setDataPoints(tempData);
                    if (onDataChange) {
                        onDataChange(tempData);
                    }
                }
            } catch (error) {
                console.error("Error refreshing scanned data:", error);
            }
        }, timerInterval);
        refreshTimerRef.current = timer;
    };

    const stopRefreshTimer = () => {
        if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            stopRefreshTimer();
        };
    }, []);

    const labels = dataPoints.map((entry) => new Date(entry.timestamp).toLocaleTimeString());
    const currentTemps = dataPoints.map((entry) => entry.temp || 0);
    const targetTemps = dataPoints.map((entry) => entry.tmode === HVAC_MODE_COOL ? entry.t_cool : entry.t_heat || 0);
    const acStates = dataPoints.map((entry) => ((entry.tstate === HVAC_MODE_HEAT || entry.tstate === HVAC_MODE_COOL) ? 1 : 0));
    const fanStates = dataPoints.map((entry) => (entry.fstate === 1 ? 1 : 0));
    const labelStep = Math.ceil(labels.length / (120 / 3));
    const displayLabels = labels.map((label, idx) => (idx % labelStep === 0 ? label : ""));

    const labelStyle = parentComponent == null ? styles.label : commonStyles.digitalLabel;
    const inputStyle = parentComponent == null ? styles.input : commonStyles.digitalSlider;
    const subHeaderStyle = parentComponent == null ? styles.subHeader : commonStyles.digitalLabel;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.controls}>
                <Text style={labelStyle}>Scanner:</Text>
                <Switch
                    value={isScannerOn}
                    onValueChange={handleToggleChange}
                />
                <Text style={labelStyle}>Interval (minutes):</Text>
                <TextInput
                    style={inputStyle}
                    keyboardType="numeric"
                    value={String(interval)}
                    onChangeText={(text) => handleIntervalChange(Number(text))}
                />
                <Text style={labelStyle}>Light Mode:</Text>
                <Switch
                    value={isDarkMode}
                    onValueChange={() => setIsDarkMode(!isDarkMode)}
                />
            </View>
            <Text style={subHeaderStyle}>Temperature (Current & Target)</Text>
            {dataPoints.length > 0 ? (
                <View style={{ marginBottom: 20, flex: 1, backgroundColor: () => chartColors.backgroundColor }}>
                    <LineChart
                        data={{
                            labels: displayLabels,
                            datasets: [
                                { data: currentTemps, color: () => chartColors.lineColorCurrentTemp, label: "Current Temp", withDots: false },
                                { data: targetTemps, color: () => chartColors.lineColorTargetTemp, label: "Target Temp", withDots: false }
                            ],
                            legend: ["Current Temp", "Target Temp"]
                        }}
                        width={chartWidth}
                        height={260}
                        yAxisSuffix="°F"
                        yAxisInterval={1}
                        xAxisInterval={5}
                        chartConfig={{
                            backgroundColor: () => chartColors.backgroundColor,
                            backgroundGradientFrom: () => chartColors.backgroundGradientFrom,
                            backgroundGradientTo: () => chartColors.backgroundGradientTo,
                            decimalPlaces: 1,
                            color: () => chartColors.color,
                            labelColor: () => chartColors.labelColor,
                            style: { borderRadius: 16 },
                            strokeWidth: 2,
                            propsForDots: { r: "3", strokeWidth: "1", stroke: "#ffa726" },
                            propsForBackgroundLines: { strokeWidth: 1, stroke: "#444444", strokeDasharray: "1, 10" },
                            propsForLabels: { fontFamily: "Roboto", fontWeight: "bold", fontSize: 11 },
                        }}
                        bezier
                        yAxisMin={60}
                        yAxisMax={95}
                        verticalLabelRotation={-45}
                        style={{ marginBottom: 20 }}
                    />
                </View>
            ) : (
                <Text style={subHeaderStyle}>No data available.</Text>
            )}
            <Text style={subHeaderStyle}>HVAC & Fan State</Text>
            {dataPoints.length > 0 ? (
                <View style={{ marginBottom: 20, flex: 1, backgroundColor: () => chartColors.backgroundColor }}>
                    <LineChart
                        data={{
                            labels: displayLabels,
                            datasets: [
                                { data: acStates, color: () => chartColors.lineColorHVAC, label: "HVAC State", withDots: false },
                                { data: fanStates, color: () => chartColors.lineColorFan, label: "Fan State", withDots: false }
                            ],
                            legend: ["HVAC State", "Fan State"]
                        }}
                        width={chartWidth}
                        height={260}
                        yAxisSuffix=""
                        yAxisInterval={1}
                        xAxisInterval={5}
                        chartConfig={{
                            backgroundColor: () => chartColors.backgroundColor,
                            backgroundGradientFrom: () => chartColors.backgroundGradientFrom,
                            backgroundGradientTo: () => chartColors.backgroundGradientTo,
                            decimalPlaces: 1,
                            color: () => chartColors.color,
                            labelColor: () => chartColors.labelColor,
                            style: { borderRadius: 16 },
                            propsForDots: { r: "4", strokeWidth: "2", stroke: "#ffa726" },
                            propsForBackgroundLines: { strokeWidth: 1, stroke: "#444444", strokeDasharray: "1, 10" },
                            propsForLabels: { fontFamily: "Roboto", fontWeight: "bold", fontSize: 11 },
                        }}
                        fromZero
                        yAxisMin={0}
                        yAxisMax={1}
                        verticalLabelRotation={-45}
                        style={{ marginBottom: 20 }}
                    />
                </View>
            ) : (
                <Text style={subHeaderStyle}>No data available.</Text>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 10 },
    subHeader: { fontWeight: "bold", fontSize: 16, marginTop: 20, marginBottom: 5 },
    controls: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
    label: { fontSize: 16, marginRight: 10 },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        padding: 5,
        width: 80,
        textAlign: "center",
        borderRadius: 5,
    },
});

const LiveChartWithExport = withExport(LiveChart);

export default (props) => {
    const [data, setData] = useState([]);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const fileName = `thermostat_${props.thermostatIp}_${dateStr}_${hour}${minute}_live.csv`;

    return <LiveChartWithExport {...props} data={data} fileName={fileName} onDataChange={setData} />;
};