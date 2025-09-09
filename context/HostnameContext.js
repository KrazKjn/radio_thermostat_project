import React, { createContext, useState, useEffect } from "react";
import { Platform } from "react-native";

export const HostnameContext = createContext("Loading..."); // ✅ Default value

export const HostnameProvider = ({ children }) => {
  const [hostname, setHostname] = useState(null);

  useEffect(() => {
    const fetchHostname = async () => {
      let host = Platform.OS === "web" ? window.location.hostname : "Unknown";
      setHostname(host);
    };

    fetchHostname();
  }, [hostname]);

  return (
    <HostnameContext.Provider value={hostname}>
      {children}
    </HostnameContext.Provider>
  );
};