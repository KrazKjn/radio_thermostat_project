import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import LiveChart from './LiveChart';
import RuntimeTrendChart from './RuntimeTrendChart';
import TempCorrelationChart from './TempCorrelationChart';
import ModeBreakdownChart from './ModeBreakdownChart';
import FanHVACEfficiencyChart from './FanHVACEfficiencyChart';
import CycleAnalyticsChart from './CycleAnalyticsChart';
import commonStyles from "../styles/commonStyles";

const DataChart = ({ thermostatIp, parentComponent = null }) => {
    const [chartMode, setChartMode] = useState("live");
    const [isDarkMode, setIsDarkMode] = useState(false);

    const subHeaderStyle = parentComponent == null
        ? styles.subHeader
        : commonStyles.digitalLabel;

    return (
        <ScrollView style={styles.container}>
            {parentComponent == null && <Text style={subHeaderStyle}>📊 Thermostat Data Chart</Text>}

            <View style={styles.tabContainer}>
                <TouchableOpacity onPress={() => setChartMode("live")} style={[styles.tab, chartMode === 'live' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'live' && styles.tabTextActive]}>Live</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartMode("runtime")} style={[styles.tab, chartMode === 'runtime' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'runtime' && styles.tabTextActive]}>Runtime</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartMode("correlation")} style={[styles.tab, chartMode === 'correlation' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'correlation' && styles.tabTextActive]}>Correlation</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartMode("mode")} style={[styles.tab, chartMode === 'mode' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'mode' && styles.tabTextActive]}>Mode</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartMode("efficiency")} style={[styles.tab, chartMode === 'efficiency' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'efficiency' && styles.tabTextActive]}>Efficiency</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setChartMode("cycles")} style={[styles.tab, chartMode === 'cycles' && styles.activeTab]}>
                    <Text style={[styles.tabText, chartMode === 'cycles' && styles.tabTextActive]}>Cycles & Cost</Text>
                </TouchableOpacity>
            </View>

            {chartMode === "live" && (
                <LiveChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
            {chartMode === "runtime" && (
                <RuntimeTrendChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
            {chartMode === "correlation" && (
                <TempCorrelationChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
            {chartMode === "mode" && (
                <ModeBreakdownChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
            {chartMode === "efficiency" && (
                <FanHVACEfficiencyChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
            {chartMode === "cycles" && (
                <CycleAnalyticsChart thermostatIp={thermostatIp} isDarkMode={isDarkMode} parentComponent={parentComponent} />
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { padding: 10 },
    subHeader: { fontWeight: "bold", fontSize: 16, marginTop: 20, marginBottom: 5 },
    tabContainer: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        marginRight: 10,
    },
    activeTab: {
        backgroundColor: '#007BFF',
        borderColor: '#007BFF',
    },
    tabText: {
        color: '#fff',
    },
    tabTextActive: {
        color: '#333',
        fontWeight: 'bold',},
});

export default DataChart;