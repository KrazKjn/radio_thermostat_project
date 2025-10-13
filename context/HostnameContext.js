import React, { createContext, useState } from "react";
import { Platform } from "react-native";

export const HostnameContext = createContext(null);

export const HostnameProvider = ({ children }) => {
  let backendUrl;

  if (Platform.OS === 'web') {
    const host = window.location.hostname; // e.g., '192.168.1.100' or 'example.com'
    backendUrl = `http://${host}:3000`; // Adjust port if needed
  } else {
    backendUrl = 'http://<your-ip>:3000'; // Replace with your dev machine IP for mobile
  }

  const [hostname, setHostname] = useState(backendUrl);

  return (
    <HostnameContext.Provider value={hostname}>
      {children}
    </HostnameContext.Provider>
  );
};