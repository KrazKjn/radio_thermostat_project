import React, { useContext, useEffect, useState } from "react";
import { View, ScrollView, Text, ActivityIndicator } from "react-native";
import ThermostatDisplay from "./ThermostatDisplay";
import { HostnameContext } from "../context/HostnameContext";
import { useAuth } from "../context/AuthContext";
import { useThermostat } from "../context/ThermostatContext";
import commonStyles from "../styles/commonStyles";

const ThermostatControl = ({ thermostatIp, activeScreen, setActiveScreen }) => {
    const { token, logout, updateAuth } = useAuth();
    const hostname = useContext(HostnameContext);
    const {
        thermostats,
        addThermostatInState,
        getCurrentTemperature,
        updateThermostatState,
        updateThermostatTime,
        rebootThermostatServer,
    } = useThermostat();
    const thermostat = thermostats[thermostatIp];
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!hostname) return;

        const thermostat = thermostats[thermostatIp];

        if (!thermostat) {
            addThermostatInState(thermostatIp, {
                thermostatName: "Loading ...",
                formattedTime: "Loading ...",
                temperature: 72,
                currentTemp: null,
                targetTemp: null,
                currentTempMode: null,
                currentFanMode: null,
                currentTempState: null,
                currentFanState: null,
                currentTime: null,
                override: null,
                hold: null,
                autoRefresh: false,
                refreshInterval: 5,
                lastUpdated: null,
                thermostatInfo: { ip: thermostatIp, model: "Loading ...", name: "Loading ..." },
            });
        } else {
            getCurrentTemperature(thermostatIp, hostname, token);
            if (thermostat.autoRefresh) {
                const interval = setInterval(() => {
                    console.log(`[ThermostatControl] ${Date().toString()}: Timer triggered, refreshing temperature`);
                    getCurrentTemperature(thermostatIp, hostname, token);
                }, thermostat.refreshInterval * 60 * 1000);

                return () => clearInterval(interval);
            }
        }
    }, [thermostatIp, addThermostatInState, hostname]);

    // Hostname validation logic before loading
    if (!hostname || typeof hostname !== "string" || hostname.length < 3) {
        return (
            <View style={[commonStyles.container, { justifyContent: "center", alignItems: "center" }]}>
                <Text style={{ color: "red", fontSize: 16 }}>
                    Invalid or missing hostname. Please check your network settings.
                </Text>
            </View>
        );
    }

    // Loading state if thermostat data is not available
    if (!thermostat) {
        return (
            <View style={[commonStyles.container, { justifyContent: "center", alignItems: "center" }]}>
                <Text>Loading thermostat data...</Text>
                <ActivityIndicator size="large" color="#0ff" />
            </View>
        );
    }

    const handleTemperatureChange = () => {
        updateThermostatState(thermostatIp, { targetTemp: thermostat.targetTemp + 1 });
    };

    return (
        <View style={commonStyles.containerBasic}>
            <ScrollView style={commonStyles.scrollContainer}>
                {!hostname ? (
                    <Text style={commonStyles.infoText}>⏳ Waiting for hostname...</Text>
                ) : (
                    <>
                        <ThermostatDisplay
                            thermostat={thermostat}
                            thermostatIp={thermostatIp}
                            token={token}
                            logout={logout}
                            hostname={hostname}
                            getCurrentTemperature={getCurrentTemperature}
                            updateThermostatTime={updateThermostatTime}
                            rebootThermostatServer={rebootThermostatServer}
                            activeScreen={activeScreen}
                            setActiveScreen={setActiveScreen}
                            menuOpen={menuOpen}
                            setMenuOpen={setMenuOpen}
                        />
                    </>
                )}
            </ScrollView>
        </View>
    );
};

export default ThermostatControl;