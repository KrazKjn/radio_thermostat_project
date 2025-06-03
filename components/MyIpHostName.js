import React, { useState, useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { NetworkInfo } from "react-native-network-info";
import commonStyles from "../styles/commonStyles";

const MyIpHostName = () => {
  const [deviceIp, setDeviceIp] = useState(null);
  const [hostName, setHostName] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        let ip;
        let host;

        if (Platform.OS === "web") {
          host = window.location.hostname;
          ip = host === "localhost" ? "127.0.0.1" : await fetch(`https://api64.ipify.org?format=json`).then(res => res.json()).then(data => data.ip);
        } else {
          ip = await NetworkInfo.getIPAddress();
        }

        setDeviceIp(ip || "Unknown");
        setHostName(host || "Unknown Hostname");

      } catch (error) {
        console.error("Error fetching IP/Hostname:", error);
      }
    };

    fetchNetworkInfo();
  }, []);

  return (
    <View style={commonStyles.headerContainer}>
      <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)} style={commonStyles.headerContainer}>
        <Text style={commonStyles.headerNetwork}>Network Info {isExpanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {isExpanded && (
        <View>
          {!deviceIp || !hostName ? (
            <ActivityIndicator size="large" color="#007AFF" />
          ) : (
            <View style={commonStyles.infoContainer}>
              <Text style={commonStyles.label}>
                📡 Device IP: <Text style={commonStyles.value}>{deviceIp}</Text>
              </Text>
              <Text style={commonStyles.label}>
                🌐 Hostname: <Text style={commonStyles.value}>{hostName}</Text>
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default MyIpHostName;