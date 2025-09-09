import React, { createContext, useState } from "react";
import { Platform } from "react-native";

export const HostnameContext = createContext(null);

export const HostnameProvider = ({ children }) => {
  // For web, use localhost:5000 for development.
  // For production, this should be replaced with the actual server URL.
  // For mobile, you'll need to use the IP address of your development machine.
  const backendUrl = Platform.select({
    web: 'http://localhost:3000',
    default: 'http://<your-dev-machine-ip>:3000', // Replace with your IP
  });

  const [hostname, setHostname] = useState(backendUrl);

  return (
    <HostnameContext.Provider value={hostname}>
      {children}
    </HostnameContext.Provider>
  );
};