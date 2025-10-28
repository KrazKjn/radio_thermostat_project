import React, { createContext, useRef, useEffect, useCallback } from "react";

const DataRefreshContext = createContext();

export const DataRefreshProvider = ({ children }) => {
  const listenersRef = useRef([]);

  // Register a listener
  const register = useCallback((listener) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== listener);
    };
  }, []);

  // Timer to notify listeners every minute
  useEffect(() => {
    const interval = setInterval(() => {
      listenersRef.current.forEach(listener => listener());
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  return (
    <DataRefreshContext.Provider value={{ register }}>
      {children}
    </DataRefreshContext.Provider>
  );
};

export default DataRefreshContext;
