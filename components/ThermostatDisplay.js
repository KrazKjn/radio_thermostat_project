import React, { useEffect, useRef, useContext } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import ThermostatToggle from "./ThermostatToggle";
import FanToggle from "./FanToggle";
import HoldToggle from "./HoldToggle";
import StatusDisplay from "./StatusDisplay";
import SwingSlider from "./SwingSlider";
import TemperatureControl from "./TemperatureControl";
import OverrideToggle from "./OverrideToggle";
import ThermostatScheduler from "./ThermostatScheduler";
import DataChart from "./DataChart";
import commonStyles from "../styles/commonStyles";
import OptionsInfo from "./OptionsInfo";
import UserManagement from "./UserManagement";
import { UserContext } from '../context/UserContext';
import DataRefreshContext from "../context/DataRefreshContext";

const Logger = require('./Logger');

const ThermostatDisplay = ({
    thermostat,
    thermostatIp,
    token,
    logout,
    hostname,
    getCurrentTemperature,
    updateThermostatName,
    rebootThermostatServer,
    activeScreen,
    setActiveScreen,
    updateThermostatTime
}) => {
    const { users, updateUser, disableUser } = useContext(UserContext);
    const { register } = useContext(DataRefreshContext);
    const showTempControlModes = new Set([1, 2]);
    const showMenu = true;
    const intervalRef = useRef();

    // Poll for temperature every 60 seconds in home mode
    useEffect(() => {
        if (typeof getCurrentTemperature === "function") {
            // Initial fetch
            getCurrentTemperature(thermostatIp, hostname, token);
            // Subscribe to refresh
            const unsubscribe = register(() => {
                Logger.info("[Timer triggered, refreshing temperature", 'ThermostatDisplay', 'useEffect');
                getCurrentTemperature(thermostatIp, hostname, token);
            });
            return () => unsubscribe();
        }
    }, [activeScreen, thermostatIp, hostname, token, getCurrentTemperature, register]);

    // Handler to update a user
    const handleUserUpdate = async (userId, updates) => {
        try {
            await updateUser(userId, updates);
            // Optionally show a success message or refresh users
        } catch (err) {
            // Handle error (show message, etc.)
        }
    };

    // Handler to disable (delete) a user
    const handleUserDelete = async (userId) => {
        try {
            await disableUser(userId);
            // Optionally show a success message or refresh users
        } catch (err) {
            // Handle error (show message, etc.)
        }
    };

    const rebootThermostat = async (thermostatIp, hostname, token) => {
        try {
            const confirmed = window.confirm("Are you sure you want to reboot the thermostat?");
            if (!confirmed) {
                Logger.info("Reboot canceled by user.", 'ThermostatDisplay', 'rebootThermostat');
                return;
            }

            Logger.info("Rebooting thermostat...", 'ThermostatDisplay', 'rebootThermostat');
            await rebootThermostatServer(thermostatIp, hostname, token);
            Logger.info("Thermostat rebooted successfully", 'ThermostatDisplay', 'rebootThermostat');
        } catch (error) {
            console.error("Error rebooting thermostat:", error);
            Logger.error(`Error rebooting thermostat: ${error.message}`, 'ThermostatDisplay', 'rebootThermostat');
        }
    };

    // Main content for each screen
    const renderScreen = () => {
        if (activeScreen === "home") {
            return (
                <>
                    {/* Top Row: Time */}
                    <View style={commonStyles.topRow}>
                        <Text style={commonStyles.digitalTime}>
                            {thermostat.formattedTime || "Loading..."}
                        </Text>
                    </View>

                    {/* Device Info Row */}
                    <View style={commonStyles.deviceInfoRow}>
                        <View style={{ flex: 1, alignItems: "flex-start" }}>
                            {/* Left item */}
                            <Text style={commonStyles.deviceInfoText}>
                                {thermostat.thermostatInfo?.name || "Thermostat"}
                            </Text>
                        </View>
                        <View style={{ flex: 1, alignItems: "center" }}>
                            {/* Center item */}
                            <Text style={commonStyles.deviceInfoText}>
                                Model: {thermostat.thermostatInfo?.model || "Unknown"}
                            </Text>
                        </View>
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                            {/* Right item */}
                            <Text style={commonStyles.deviceInfoText}>
                                IP: {thermostat.thermostatInfo?.ip || thermostatIp}
                            </Text>
                        </View>
                    </View>

                    {/* Room Temperature */}
                    <View style={commonStyles.digitalTempRow}>
                        <View style={commonStyles.digitalTempBlock}>
                            <Text style={commonStyles.digitalLabel}>Room</Text>
                            <Text style={commonStyles.digitalTemp}>
                                {thermostat.currentTemp ?? "--"}
                                <Text style={commonStyles.digitalUnit}>°F</Text>
                            </Text>
                            <Text style={commonStyles.digitalHumidity}>
                                {thermostat.humidity ?? "--"}% RH
                            </Text>
                        </View>
                        {thermostat.outdoor_temp && (
                            <Text style={commonStyles.digitalTempSeparator}>
                                /
                            </Text>
                        )}
                        {thermostat.outdoor_temp && (
                            <View style={commonStyles.digitalTempBlock}>
                                <Text style={commonStyles.digitalLabel}>Outdoor</Text>
                                <Text style={commonStyles.digitalTemp}>
                                    {thermostat.outdoor_temp}
                                    <Text style={commonStyles.digitalUnit}>°F</Text>
                                </Text>
                                <Text style={commonStyles.digitalHumidity}>
                                    {thermostat.outdoor_humidity ?? "--"}% RH
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Target Temperature Control */}
                    {showTempControlModes.has(thermostat.currentTempMode) && (
                        <View style={commonStyles.targetRow}>
                            <TemperatureControl
                                thermostatIp={thermostatIp}
                                thermostat={thermostat}
                            />
                        </View>
                    )}

                    {/* Swing Slider */}
                    {showTempControlModes.has(thermostat.currentTempMode) && (
                        <View style={commonStyles.swingRow}>
                            <SwingSlider thermostatIp={thermostatIp} />
                        </View>
                    )}

                    {/* Mode, Fan, Override, Hold */}
                    <View style={commonStyles.centerRow}>
                        <ThermostatToggle
                            thermostatIp={thermostatIp}
                            TempMode={thermostat.currentTempMode}
                        />
                        <FanToggle
                            thermostatIp={thermostatIp}
                            FanMode={thermostat.currentFanMode}
                        />
                    </View>
                    <View style={commonStyles.centerRow}>
                        <OverrideToggle
                            thermostatIp={thermostatIp}
                            OverrideMode={thermostat.override}
                        />
                        <HoldToggle
                            thermostatIp={thermostatIp}
                            HoldMode={thermostat.hold}
                        />
                    </View>

                    {/* Status */}
                    <StatusDisplay thermostatData={thermostat} />
                </>
            );
        }
        if (activeScreen === "schedule") {
            return <ThermostatScheduler thermostatData={thermostat} />;
        }
        if (activeScreen === "chart") {
            return <DataChart thermostatIp={thermostatIp} parentComponent={this} />;
        }
        if (activeScreen === "users") {
            return (
                <UserManagement
                    users={users}
                    onUserUpdate={handleUserUpdate}
                    onUserDelete={handleUserDelete}
                />
            );
        }
        if (activeScreen === "options") {
            return (
                <OptionsInfo thermostat={thermostat} />
            );
        }
        return null;
    };

    return (
        <View style={commonStyles.thermostatDevice}>
            <View style={commonStyles.thermostatContentRow}>
                {/* Main Content Area */}
                <View style={commonStyles.thermostatContentColumn}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {renderScreen()}
                    </ScrollView>
                </View>
                {/* Permanent Vertical Menu Column with actions */}
                {showMenu && (<View style={commonStyles.menuColumnPermanent}>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => setActiveScreen("home")}>
                        <Icon name="home-outline" size={28} color={activeScreen === "home" ? "#0ff" : "#aaa"} />
                        <Text style={commonStyles.menuText}>Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => setActiveScreen("chart")}>
                        <Icon name="stats-chart-outline" size={28} color={activeScreen === "chart" ? "#0ff" : "#aaa"} />
                        <Text style={commonStyles.menuText}>Charts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => setActiveScreen("schedule")}>
                        <Icon name="calendar-outline" size={28} color={activeScreen === "schedule" ? "#0ff" : "#aaa"} />
                        <Text style={commonStyles.menuText}>Schedules</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => setActiveScreen("users")}>
                        <Icon name="settings-outline" size={28} color={activeScreen === "users" ? "#0ff" : "#aaa"} />
                        <Text style={commonStyles.menuText}>Users</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => setActiveScreen("options")}>
                        <Icon name="settings-outline" size={28} color={activeScreen === "options" ? "#0ff" : "#aaa"} />
                        <Text style={commonStyles.menuText}>Options</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem}>
                        <Icon name="remove-outline" size={28} color="#0ff" />
                        <Text style={commonStyles.menuText}></Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => updateThermostatTime(thermostatIp, hostname, token)} >
                        <Icon name="time-outline" size={28} color={"#0ff"} />
                        <Text style={commonStyles.menuText}>Sync Time</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => getCurrentTemperature(thermostatIp, hostname, token, false)} >
                        <Icon name="refresh-outline" size={28} color={"#0ff"} />
                        <Text style={commonStyles.menuText}>Refresh</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={() => rebootThermostat(thermostatIp, hostname, token)} >
                        <Icon name="reload-outline" size={28} color={"#0ff"} />
                        <Text style={commonStyles.menuText}>Reboot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={commonStyles.menuItem} onPress={logout} >
                        <Icon name="log-out-outline" size={28} color={"#dc3545"} />
                        <Text style={[commonStyles.menuText, { color: "#dc3545" }]}>Logout</Text>
                    </TouchableOpacity>
                </View>)}
            </View>
        </View>
    );
};

export default ThermostatDisplay;