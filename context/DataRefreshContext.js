import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { useIsFocused } from "@react-navigation/native";

const DataRefreshContext = createContext();
const Logger = require('../components/Logger');

export const DataRefreshProvider = ({ children }) => {
  const [lastUpdated, setLastUpdated] = useState(null);
  const listenersRef = useRef(new Map());
  const intervalRef = useRef(null);
  const isFocused = useIsFocused();

  // Register a listener
  const register = useCallback((id, listener) => {
    Logger.info(`Registering data refresh listener: ${id}`, 'DataRefreshContext', 'register');
    listenersRef.current.set(id, listener);
  }, []);

  const unregister = useCallback((id) => {
    Logger.info(`Unregistering data refresh listener: ${id}`, 'DataRefreshContext', 'unregister');
    listenersRef.current.delete(id);
  }, []);

  // Timer to notify listeners every minute
  useEffect(() => {
    const startTimer = () => {
        if (!intervalRef.current) {
            Logger.info("Starting timer", 'DataRefreshContext', 'startTimer');
            intervalRef.current = setInterval(() => {
                setLastUpdated(Date.now());
                listenersRef.current.forEach(listener => listener());
            }, 60000); // 1 minute
        }
    }

    const stopTimer = () => {
        if (intervalRef.current) {
            Logger.info("Stopping timer", 'DataRefreshContext', 'stopTimer');
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }

    if (isFocused) {
        startTimer();
    } else {
        stopTimer();
    }

    return () => stopTimer();
  }, [isFocused]);

  return (
    <DataRefreshContext.Provider value={{ register, unregister, lastUpdated }}>
      {children}
    </DataRefreshContext.Provider>
  );
};

export default DataRefreshContext;
