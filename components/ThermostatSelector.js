import React, { useContext, useState, useEffect } from "react";
import { View, Text, ScrollView, Button, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { NetworkInfo } from "react-native-network-info";
import { HostnameContext } from "../context/HostnameContext";
import { useAuth } from "../context/AuthContext";
import { useThermostat } from "../context/ThermostatContext";
import ThermostatControl from "./ThermostatControl";
import commonStyles from "../styles/commonStyles";

const ThermostatSelector = () => {
  const { token, logout, updateAuth } = useAuth();
  const hostname = useContext(HostnameContext);
  const data = { temp: "🔍", tmode: 0, fmode: 0, override: 0, hold: 0, t_cool: "🔍", t_heat: "🔍", tstate: 0, fstate: 0, time: { day: 0, hour: 0, minute: 0 } };
  const [subnet, setSubnet] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [activeScreen, setActiveScreen] = useState("home");
  const [thermostatData, setThermostatData] = useState({
    "Loading ...": { ...data, lastUpdated: Date.now() }
  });
  const {
      //thermostats,
      getThermostats,
      addThermostat,
      scanForThermostats,
  } = useThermostat();
  const [thermostats, setThermostats] = useState(null);

  useEffect(() => {
    const fetchIPAddress = async () => {
      try {
        let ip;

        if (Platform.OS === "web") {
          ip = window.location.hostname; // Use browser-native method
          if (ip === "localhost")
          {            
            ip = "192.168.0.1"; // Fallback to a default IP for localhost
          }
        } else if (NetworkInfo?.getIPAddress) {
          ip = await NetworkInfo.getIPAddress();
        } else {
          console.warn("NetworkInfo module not available.");
          return;
        }

        if (ip) {
          const extractedSubnet = getSubnet(ip);
          if (extractedSubnet) {
            setSubnet(extractedSubnet);
            console.log("Device IP:", ip);
            console.log("Subnet:", extractedSubnet);
          }
        } else {
          console.warn("Failed to retrieve IP address.");
        }
      } catch (error) {
        console.error("Error fetching IP address:", error.message);
      }
    };

    fetchIPAddress();
    
    const fetchData = async () => {
      const definedThermostats = await getThermostats(hostname, token);
      // Testing
      //if (false && definedThermostats.length > 0) {
      if (definedThermostats !== undefined && definedThermostats.length > 0) {
        setThermostats(definedThermostats);
        console.log(definedThermostats);
      } else {
        if (!hostname) {
          console.warn("Hostname is not available yet.");
          return;
        }
        if (!subnet) {
          console.warn("Subnet not detected. Unable to scan.");
          return;
        }
        const thermostatScan = await scanForThermostats(hostname, token, subnet);
        if (thermostatScan.length > 0) {
          console.log(thermostatScan);
          setThermostats(thermostatScan);
        }
        setThermostats(null);
      }
    };

    fetchData();
  }, []);

  // Function to get subnet from IP address
  const getSubnet = (ipAddress) => {
    const octets = ipAddress.split(".");
    return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}` : null;
  };

  const scanNetwork = async () => {
    if (!hostname) {
      console.warn("Hostname is not available yet.");
      return;
    }
    if (!subnet) {
      console.warn("Subnet not detected. Unable to scan.");
      return;
    }

    const thermostatScan = await scanForThermostats(hostname, token, subnet);
    if (thermostatScan.length > 0) {
      setThermostats(thermostatScan);
      console.log(thermostatScan);
    } else {
      setThermostats(null);
    }
  };

  if (thermostats === undefined || thermostats === null) {
    return (
      <View style={{ margin: 16 }}>
        <View style={[commonStyles.digitalCard, { alignItems: "center" }]}>
          <ActivityIndicator size="large" color="#7A7AFF" />
          <Text style={{ color: "#7A7AFF" }}>⏳ Waiting for thermostats...</Text>
          <TouchableOpacity onPress={() => getThermostats(hostname, token)}>
            <Text style={{ color: "#007AFF", marginTop: 10 }}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  } else {
    if (thermostats.length === 0) {
      // Show add IP or scan options
      return (
        <View style={commonStyles.containerSimple}>
          <Button title="Scan for Thermostats" onPress={scanNetwork} />
          <ScrollView>
            {thermostats.length > 0 ? (
              thermostats.map((device, index) => (
                <Text key={index}>Detected: {thermostats.name} - 📡 IP: {thermostats.ip} | 🏷 Model: {thermostats.manufacturer}</Text>
              ))
            ) : (
              <View>
                <Text>No devices found.</Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    } else {
      const contentDB = thermostats
        .filter(thermostat => thermostat.enabled === 1) // Select only enabled thermostats
        .map((thermostat, index) => (
          <View style={commonStyles.containerSimple} key={thermostat.location}>
            <ThermostatControl
              thermostatIp={thermostat.ip}
              thermostatData={thermostatData}
              setThermostatData={setThermostatData}
              activeScreen={activeScreen}
              setActiveScreen={setActiveScreen}
            />
          </View>
      ));
      return (
        <View style={{ flex: 1 }}>
          {/* Tab Navigation */}
          <View style={commonStyles.tabContainer}>
            {thermostats
              .filter(thermostat => thermostat.enabled === 1) // Select only enabled thermostats
              .map((tab, index) => (
                <TouchableOpacity
                  key={index}
                  style={[commonStyles.tab, activeTab === index && commonStyles.activeTab]}
                  onPress={() => setActiveTab(index)}
                >
                  <Text style={[commonStyles.tabText, activeTab === index && commonStyles.activeTabText]}>{tab.location}</Text>
                </TouchableOpacity>
            ))}
          </View>

          {/* Content Section */}
          <ScrollView style={commonStyles.containerScroll}>{contentDB[activeTab]}</ScrollView>
        </View>
      );
    }
  }
};


export default ThermostatSelector;