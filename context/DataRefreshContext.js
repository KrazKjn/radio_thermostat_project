import React, { createContext, useState, useRef, useEffect, useCallback } from "react";
import { useIsFocused } from "@react-navigation/native";

const DataRefreshContext = createContext();

export const DataRefreshProvider = ({ children }) => {
  const [lastUpdated, setLastUpdated] = useState(null);
  const listenersRef = useRef(new Map());
  const intervalRef = useRef(null);
  const isFocused = useIsFocused();

  // Register a listener
  const register = useCallback((id, listener) => {
    listenersRef.current.set(id, listener);
  }, []);

  const unregister = useCallback((id) => {
    listenersRef.current.delete(id);
  }, []);

  // Timer to notify listeners every minute
  useEffect(() => {
    const startTimer = () => {
        if (!intervalRef.current) {
            console.log("Starting timer");
            intervalRef.current = setInterval(() => {
                setLastUpdated(Date.now());
                listenersRef.current.forEach(listener => listener());
            }, 60000); // 1 minute
        }
    }

    const stopTimer = () => {
        if (intervalRef.current) {
            console.log("Stopping timer");
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
