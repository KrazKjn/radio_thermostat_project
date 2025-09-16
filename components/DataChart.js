import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Switch, TextInput, StyleSheet, Button, useWindowDimensions, Share, Platform } from "react-native";
import { LineChart } from "react-native-chart-kit";
import * as FileSystem from 'expo-file-system'; // If using Expo, otherwise use react-native-fs or similar
import * as Sharing from 'expo-sharing'; // For sharing the file
import { useThermostat } from "../context/ThermostatContext";
import { useAuth } from "../context/AuthContext";
import { HostnameContext } from "../context/HostnameContext";
import commonStyles from "../styles/commonStyles";
import { HVAC_MODE_OFF, HVAC_MODE_HEAT, HVAC_MODE_COOL, HVAC_MODE_AUTO } from '../constants/hvac_mode'; // Import HVAC modes
import DataRefreshContext from "../context/DataRefreshContext";

const DataChart = ({ thermostatIp, parentComponent = null }) => {
    const { token } = useAuth();
    const hostname = React.useContext(HostnameContext);
    const { register } = React.useContext(DataRefreshContext);
    const { fetchScannedData, getScannerStatus, startScanner, stopScanner, thermostats, updateThermostatState, formatTime, formatCurrentTime, isTokenExpired,  } = useThermostat();
    const [dataPoints, setDataPoints] = useState([]);
    const [isScannerOn, setIsScannerOn] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [interval, setIntervalValue] = useState(1); // Default interval: 1 minute
    const [refreshTimer, setRefreshTimer] = useState(null); // Timer for refreshing data
    const refreshTimerRef = useRef(null);
    const { width: windowWidth } = useWindowDimensions();
    const chartWidth = Math.max( (parentComponent !== null ? parentComponent.innerWidth - 150 : windowWidth - 40), 320); // 40 for padding, min 320px

    // Fetch scanned data on component mount
    const fetchData = async () => {
        try {
            const scannedData = await fetchScannedData(thermostatIp, hostname, token);
            let localDateTime = new Date(Date.now()).toLocaleString();
            console.log(`${localDateTime} [DataChart] Data fetched: `, scannedData);
            let filteredData = scannedData.filter(entry => entry.temp !== 0);
            localDateTime = new Date(Date.now()).toLocaleString();            
            console.log(`${localDateTime} [DataChart] Data fetched (filteredData): `, filteredData);
            setDataPoints(prev => {
                // Check if lastUpdated is in ascending order
                const isAscending = filteredData.length > 1 &&
                filteredData[0].lastUpdated < filteredData[filteredData.length - 1].lastUpdated;

                // Reverse to show newest data on the right
                const tempData = isAscending ? filteredData : [...filteredData].reverse();

                // Log if data actually changed
                if (JSON.stringify(prev) !== JSON.stringify(tempData)) {
                    console.log("[DataChart] Updating chart data");
                } else {
                    console.log("[DataChart] Data unchanged, no update");
                }
                return tempData;
            });
        } catch (error) {
            console.error("Error fetching scanned data:", error);
        }
    };

    // Check scanner status on initialization
    useEffect(() => {
        const checkScannerStatus = async () => {
            try {
                const status = await getScannerStatus(thermostatIp, hostname, token);
                if (status) {
                    setIsScannerOn(true);
                    setIntervalValue(Math.max(1, Math.round(status.interval / 60000))); // Convert ms to minutes
                    startRefreshTimer(); // Start the local timer
                } else {
                    handleToggleChange(true); // Start scanner if not running
                }
            } catch (error) {
                console.error("Error checking scanner status:", error);
            }
        };

        checkScannerStatus();
    }, [thermostatIp, getScannerStatus]);

    useEffect(() => {
        fetchData();
        // Subscribe to central refresh
        const unsubscribe = register(fetchData);
        return () => unsubscribe();
    }, [thermostatIp, register]);

    // Handle toggle change
    const handleToggleChange = async (value) => {
        setIsScannerOn(value);
        if (value) {
            try {
                startRefreshTimer(); // Start the local timer
                await startScanner(thermostatIp, hostname, token, interval * 60000); // Convert minutes to ms
            } catch (error) {
                console.error("Error starting scanner:", error);
            }
        } else {
            try {
                stopRefreshTimer(); // Stop the local timer
                await stopScanner(thermostatIp, hostname, token);
            } catch (error) {
                console.error("Error stopping scanner:", error);
            }
        }
    };

    // Handle interval change
    const handleIntervalChange = async (newInterval) => {
        const validatedInterval = Math.max(1, newInterval); // Enforce a minimum value of 1 minute
        setIntervalValue(validatedInterval);
        if (isScannerOn) {
            try {
                stopRefreshTimer(); // Stop the old timer
                await stopScanner(thermostatIp, hostname, token); // Stop the current scanner
                startRefreshTimer(validatedInterval * 60000); // Start a new timer with the updated interval
                await startScanner(thermostatIp, hostname, token, validatedInterval * 60000); // Restart with new interval in ms
            } catch (error) {
                console.error("Error updating scanner interval:", error);
            }
        }
    };

    // Start the local refresh timer
    const startRefreshTimer = (customInterval) => {
        const timerInterval = customInterval || interval * 60000; // Convert minutes to ms
        stopRefreshTimer(); // Ensure no duplicate timers
        const timer = setInterval(async () => {
            try {
                const scannedData = await fetchScannedData(thermostatIp, hostname, token);
                // Compare latest scanned data with context data
                if (isTokenExpired(token)) {
                    console.error("Token expired. Please log in again.");
                    stopRefreshTimer();
                    return;
                }
                if (scannedData.length > 0) {
                    const latestScan = { currentTemp: scannedData[0].temp,
                        targetTemp: scannedData[0].tmode === HVAC_MODE_COOL ? scannedData[0].t_cool : scannedData[0].t_heat || null,
                        currentTempMode: scannedData[0].tmode,
                        currentFanMode: scannedData[0].fmode,
                        currentTempState: scannedData[0].tstate,
                        currentFanState: scannedData[0].fstate,
                        currentTime: scannedData[0].time,
                        formattedTime: scannedData[0].time ? formatTime(scannedData[0].time) : "Loading...",
                        override: scannedData[0].override,
                        hold: scannedData[0].hold,
                        lastUpdated: Date.now(),
                    };
                    const contextData = thermostats[thermostatIp] || {};
                    // Shallow compare relevant fields (expand as needed)
                    const fieldsToCheck = ["targetTemp", "currentTempMode", "currentFanMode", "currentTime", "formattedTime", "override", "hold"];
                    const hasDifference = fieldsToCheck.some(
                        key => latestScan[key] !== contextData[key]
                    );
                    if (hasDifference) {
                        updateThermostatState(thermostatIp, latestScan);
                    }
                    // Check if lastUpdated is in ascending order
                    const isAscending = scannedData.length > 1 &&
                    scannedData[0].lastUpdated < scannedData[scannedData.length - 1].lastUpdated;
                    setDataPoints(isAscending ? scannedData : [...scannedData].reverse());
                }
            } catch (error) {
                console.error("Error refreshing scanned data:", error);
            }
        }, timerInterval);
        setRefreshTimer(timer);
        refreshTimerRef.current = timer;
    };

    // Stop the local refresh timer
    const stopRefreshTimer = () => {
        if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
        setRefreshTimer(null);
    };

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            stopRefreshTimer(); // Clear the timer when the component unmounts
        };
    }, []);

    // Prepare chart data
    const labels = dataPoints.map((entry) =>
        new Date(entry.timestamp).toLocaleTimeString()
    );
    const currentTemps = dataPoints.map((entry) => entry.temp || 0);
    const targetTemps = dataPoints.map((entry) => entry.tmode === HVAC_MODE_COOL ? entry.t_cool : entry.t_heat || 0);
    const acStates = dataPoints.map((entry) => ((entry.tstate === HVAC_MODE_HEAT || entry.tstate === HVAC_MODE_COOL) ? 1 : 0));
    const fanStates = dataPoints.map((entry) => (entry.fstate === 1 ? 1 : 0));

    // Export cached data to CSV
    const exportToCSV = async () => {
        try {
            if (!dataPoints.length) {
                alert("No data to export.");
                return;
            }

            /// Prepare CSV header and row
            const headers = Object.keys(dataPoints[0]);
            const csvRows = [
                headers.join(","),
                ...dataPoints.map(row =>
                    headers.map(h => {
                        if (h === "timestamp") return new Date(row.timestamp).toLocaleString();
                        if (h === "time") return formatTime(row.time).replace(/,/g, "");;
                        return JSON.stringify(row[h] ?? "");
                    }).join(",")
                )
            ];
            const csvString = csvRows.join("\n");
            // Before creating the fileName, get the current date, hour, and minute
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const fileName = `thermostat_${thermostatIp}_${dateStr}_${hour}${minute}_cache.csv`;

            // Share or download
            if (Platform.OS === "web") {
                // Web: use Blob and download
                const blob = new Blob([csvString], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.setAttribute("download", fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else if (FileSystem.cacheDirectory) {
                // Mobile: use expo-file-system and sharing
                const fileUri = FileSystem.cacheDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
                await Sharing.shareAsync(fileUri, { mimeType: "text/csv" });
            } else {
                alert("File system not available on this platform.");
            }
        } catch (error) {
            console.error("Error exporting CSV:", error);
            alert("Failed to export CSV.");
        }
    };

    // Label configuration
    const labelStep = Math.ceil(labels.length / (120 / 3)); // Show max 8 labels
    const displayLabels = labels.map((label, idx) => (idx % labelStep === 0 ? label : ""));

    // Use digitalLabel if parentComponent is null, otherwise use default or custom style
    const labelStyle = parentComponent == null
        ? styles.label
        : commonStyles.digitalLabel;
    const inputStyle = parentComponent == null
        ? styles.input
        : commonStyles.digitalSlider;
    const subHeaderStyle = parentComponent == null
        ? styles.subHeader
        : commonStyles.digitalLabel;

    const chartColors = isDarkMode
  ? {
        //color: (opacity = 1) => `rgba(0,255,255,${opacity})`,      // cyan lines
        //labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`, // white labels
        color: "#FFFFFF",
        labelColor: "#aaa",
        backgroundColor: "transparent",
        backgroundGradientFrom: "#0f0f0f",
        backgroundGradientTo: "#ffffff",
        lineColorCurrentTemp: "#0ff",
        lineColorTargetTemp: "#FFA500",
        lineColorHVAC:  "#0ff",
        lineColorFan: "#FFA500"
    }
  : {
        //color: (opacity = 1) => `rgba(0,0,0,${opacity})`,          // black lines
        //labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,     // black labels
        color: "#222",
        labelColor: "#aaa",
        backgroundColor: "#222",
        backgroundGradientFrom: "#222",
        backgroundGradientTo: "#222",
        lineColorCurrentTemp: "#FF0000",
        lineColorTargetTemp: "#00FF00",
        lineColorHVAC: "#0000FF",
        lineColorFan: "#FFA500"
    };
        
    return (
        <ScrollView style={styles.container}>
            {parentComponent == null && <Text style={styles.header}>📊 Thermostat Data Chart</Text>}

            {/* Export Button */}
            {parentComponent == null && <View style={{ marginBottom: 10 }}>
                <Button title="Export Cached Data to CSV" onPress={exportToCSV} />
            </View>}

            {/* Scanner Controls */}
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

            {/* Chart */}
            <Text style={subHeaderStyle}>Temperature (Current & Target)</Text>
            {dataPoints.length > 0 ? (
                <View style={{ marginBottom: 20, flex: 1, backgroundColor: () => chartColors.backgroundColor }}>
                  <LineChart
                      data={{
                          labels: displayLabels,
                          datasets: [
                              {
                                  data: currentTemps,
                                  color: () => chartColors.lineColorCurrentTemp,
                                  label: "Current Temp"
                              },
                              {
                                  data: targetTemps,
                                  color: () => chartColors.lineColorTargetTemp,
                                  label: "Target Temp"
                              }
                          ],
                          legend: ["Current Temp", "Target Temp"]
                      }}
                      width={chartWidth}
                      height={260} // Increase from 220 to 260 or more
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
                          propsForDots: {
                            r: "4",
                            strokeWidth: "1",
                            stroke: "#ffa726",
                          },
                          propsForBackgroundLines: {
                            strokeWidth: 1,  // Make lines thicker (> 1)
                            stroke: "#444444",  // Solid gray axis lines
                            strokeDasharray: "1, 10",  // Change dashed effect
                          },
                          propsForLabels: {
                            fontFamily: "Roboto", // Or "Arial", "Helvetica Neue", etc.
                            fontWeight: "bold",   // Optional
                            fontSize: 11,         // Optional
                            zIndex: 1,
                          },
                      }}
                      bezier
                      yAxisMin={60} // Set minimum temperature
                      yAxisMax={95} // Set maximum temperature
                      verticalLabelRotation={-45} // <--- Add this line
                      style={{ marginBottom: 20 }} // Add extra space below the chart
                  />
                </View>
            ) : (
                <Text>No data available.</Text>
            )}

            {/* HVAC & Fan State Chart */}
            <Text style={subHeaderStyle}>HVAC & Fan State</Text>
            {dataPoints.length > 0 ? (
                <View style={{ marginBottom: 20, flex: 1, backgroundColor: () => chartColors.backgroundColor }}>
                    <LineChart
                        data={{
                            labels: displayLabels,
                            datasets: [
                                {
                                    data: acStates,
                                    color: () => chartColors.lineColorHVAC,
                                    label: "HVAC State"
                                },
                                {
                                    data: fanStates,
                                    color: () => chartColors.lineColorFan,
                                    label: "Fan State"
                                }
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
                            propsForDots: {
                                r: "4",
                                strokeWidth: "2",
                                stroke: "#ffa726",
                            },
                            propsForBackgroundLines: {
                                strokeWidth: 1,  // Make lines thicker (> 1)
                                stroke: "#444444",  // Solid gray axis lines
                                strokeDasharray: "1, 10",  // Change dashed effect
                            },
                            propsForLabels: {
                                fontFamily: "Roboto", // Or "Arial", "Helvetica Neue", etc.
                                fontWeight: "bold",   // Optional
                                fontSize: 11,         // Optional
                                zIndex: 1,
                            },
                        }}
                        fromZero
                        yAxisMin={0}
                        yAxisMax={1} // Set max to 1 for binary state representation
                        verticalLabelRotation={-45} // <--- Add this line
                        style={{ marginBottom: 20 }} // Add extra space below the chart
                    />
                </View>
            ) : (
                <Text>No data available.</Text>
            )}

            {/* Export Button */}
            {parentComponent !== null && <View style={{ marginBottom: 10 }}>
                <Button title="Export Cached Data to CSV" onPress={exportToCSV} />
            </View>}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 10 },
    header: { fontWeight: "bold", fontSize: 18, marginBottom: 10 },
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

export default DataChart;