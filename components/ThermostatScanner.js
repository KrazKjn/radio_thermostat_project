import React, { useState, useEffect, useContext } from "react";
import { View, Text, Button, ScrollView, Platform, ActivityIndicator, TouchableOpacity } from "react-native";
import { NetworkInfo } from "react-native-network-info";
import { HostnameContext } from "../context/HostnameContext";
import { useAuth } from "../context/AuthContext";
import { useThermostat } from "../context/ThermostatContext";
import apiFetch from "../utils/apiFetch"; // Assuming you have a utility function for API calls
import commonStyles from "../styles/commonStyles";

const ThermostatScanner = () => {
  const { token, logout, updateAuth } = useAuth();
  const hostname = useContext(HostnameContext);
  const [devices, setDevices] = useState([]);
  const [subnet, setSubnet] = useState("");
  const { scanForThermostats, addThermostat, fetchModelInfo, fetchModelInfoDetailed } = useThermostat();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");

  // Function to get subnet from IP address
  const getSubnet = (ipAddress) => {
    const octets = ipAddress.split(".");
    return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}` : null;
  };

  // Get the device's IP address and determine the subnet dynamically
  useEffect(() => {
    if (!hostname) return; // ✅ Prevents premature execution

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
  }, [hostname]);

  if (!hostname) {
    return (
      <View style={{ padding: 20 }}>
        <Text>⏳ Waiting for hostname...</Text>
      </View>
    );
  }

  const scanNetwork = async () => {
    if (!hostname) {
      console.warn("Hostname is not available yet.");
      return;
    }
    if (!subnet) {
      console.warn("Subnet not detected. Unable to scan.");
      return;
    }

    let foundDevices = [];
    for (let i = 20; i <= 30; i++) {
      const ip = `${subnet}.${i}`;
      try {
        const data = await apiFetch(
          `${hostname}/thermostat/${ip}`,
          "GET",
          null,
          token,
          "Error fetching thermostat data",
          "Fetching cached thermostat data...",
          logout,
          updateAuth,
          3000
        );
        if (data && data.model) {
            foundDevices.push({ ip, model: data.model, name: data.name });
        }
      } catch (error) {
        console.log(`Failed to connect to ${ip}:`, error.message);
      }
    }

    setDevices(foundDevices);
  };

  const scanNetwork2 = async () => {
    if (!hostname) {
      console.warn("Hostname is not available yet.");
      return;
    }
    if (!subnet) {
      console.warn("Subnet not detected. Unable to scan.");
      return;
    }

    let foundDevices = [];
    setDevices(foundDevices);
    const thermostatScan = await scanForThermostats(hostname, subnet);
    if (thermostatScan !== undefined || thermostatScan != null) {
      const devices = JSON.parse(thermostatScan);
      if (devices.length > 0) {
        devices.map((device, index) => (
          foundDevices.push({ id: device.id, ip: device.ip, model: device.manufacturer, name: device.location })
        ));
        console.log(thermostatScan);
      }
    }
    foundDevices.push({id: null, ip: '192.168.100.10', model: 'Test', name: 'Test Location' });
    setDevices(foundDevices);
  };

  const handleScan = (version = 0) => {
    setLoading(true);
    setResult(null);
    // Use setTimeout to ensure ActivityIndicator renders before scan starts
    setTimeout(async () => {
      try {
        const start = Date.now(); // Capture start time
        let scanResult = null;
        if (version === 0) {
          scanResult = await scanNetwork();
        } else {
          scanResult = await scanNetwork2();
        }
        const end = Date.now(); // Capture end time
        console.log(`Scan Completed: ${(end - start) / 1000} seconds`);
        setResult(`Scan Completed: ${(end - start) / 1000} seconds`);
      } catch (e) {
        console.log(`Scan error: ${e}.`);
        setResult(`Scan error: ${e}.`);
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const addThermostatToSystem = async (device) => {
    // Function to add thermostat
    console.log("Add thermostat:", device);
    const modelInfo = await fetchModelInfoDetailed(device.ip, hostname);
    const uuid = modelInfo.sys.uuid;
    const ip = device.ip;
    const model = device.model;
    const location = device.name;
    const cloudUrl = modelInfo.cloud.url;
    const cloudAuthkey = modelInfo.cloud.authkey;
    const scanInterval = modelInfo.cloud.interval;
    const scanMode = modelInfo.cloud.enabled ? 2 : 1;

    addThermostat(hostname, {
      uuid,
      ip,
      model,
      location,
      cloudUrl,
      cloudAuthkey,
      scanInterval,
      scanMode
    });
  };

  const handleAdd = async (device) => {
    try {
      await addThermostatToSystem(device);
      setMessage("Thermostat added successfully!");
      setDevices(prevDevices =>
        prevDevices.map(prevDevice =>
          device.ip === prevDevice.ip ? { ...prevDevice, id: Math.floor(Math.random() * 1000000) } : prevDevice
        )
      );
    } catch (e) {
      setMessage("Failed to add thermostat.");
    }
  };

  return (
    <View style={{ padding: 20 }}>
      {!hostname ? (
        <Text>⏳ Waiting for hostname...</Text>
      ) : (
        <>
          {/* <Button title={`Scan ${subnet} for Thermostats (20-30)`} onPress={() => handleScan(0)} disabled={loading} /> */}
          <Button title={`Scan subnet [${subnet}] for Thermostats`} onPress={() => handleScan(1)} disabled={loading} />
          {result && (
            <Text style={commonStyles.digitalButtonText}>{JSON.stringify(result)}</Text>
          )}
          <ScrollView>
            {devices.length > 0 ? (
              devices.map((device, index) => (
                <View
                  key={index}
                  style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
                >
                  <Text style={[commonStyles.deviceInfoText, { flex: 1 }]}>
                    Detected: {device.name ?? device.location} - 📡 IP: {device.ip} | 🏷 Model: {device.model ?? device.manufacturer}
                  </Text>
                  { device.id === null && (
                    <TouchableOpacity
                      style={commonStyles.digitalButton}
                      onPress={() => handleAdd(device)}
                    >
                      <Text style={commonStyles.digitalButtonText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            ) : (
              loading ? (
                <View style={[commonStyles.digitalCard, { margin: 16, alignItems: "center" }]}>
                  <ActivityIndicator size="large" color="#7A7AFF" />
                  <Text style={commonStyles.deviceInfoText}>⏳ Scanning for thermostats...</Text>
                </View>
              ) : (
                <Text style={commonStyles.errorText}>No devices found.</Text>
              )
            )}            
          </ScrollView>
          {message !== "" && (
            <Text style={{ color: message.includes("success") ? "green" : "red" }}>
              {message}
            </Text>
          )}
        </>
      )}
    </View>
  );
};

export default ThermostatScanner;