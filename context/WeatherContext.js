import React, { createContext, useState, useContext, useEffect } from 'react';
import { HostnameContext } from './HostnameContext';
import { useAuth } from './AuthContext';
import apiFetch from '../utils/apiFetch';

const WeatherContext = createContext();

export const WeatherProvider = ({ children }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const hostname = useContext(HostnameContext);
    const { token } = useAuth();

    const fetchWeather = async () => {
        try {
            // Replace with your actual coordinates or get them dynamically
            const latitude = '42.3478';
            const longitude = '-71.0466';
            
            const data = await apiFetch(
                `${hostname}/weather?latitude=${latitude}&longitude=${longitude}`,
                'GET',
                null,
                token
            );
            
            setWeatherData(data);
            setLastFetch(Date.now());
        } catch (error) {
            console.error('Error fetching weather:', error);
        }
    };

    // Fetch weather data every 5 minutes
    useEffect(() => {
        fetchWeather();
        const interval = setInterval(fetchWeather, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [token, hostname]);

    return (
        <WeatherContext.Provider value={{ weatherData, lastFetch, fetchWeather }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);