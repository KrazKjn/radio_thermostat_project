import React, { createContext, useState, useContext, useEffect } from 'react';
import { HostnameContext } from './HostnameContext';
import { useAuth } from './AuthContext';
import apiFetch from '../utils/apiFetch';

const Logger = require('../components/Logger');
const WeatherContext = createContext();
const WEATHER_LATITUDE = 29.8238;
const WEATHER_LONGITUDE = -90.4751;

export const WeatherProvider = ({ children }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const hostname = useContext(HostnameContext);
    const { authenticatedApiFetch } = useAuth();

    const fetchWeather = async (latitude, longitude) => {
        if (!latitude) latitude = WEATHER_LATITUDE;
        if (!longitude) longitude = WEATHER_LONGITUDE;
        if (!latitude || !longitude) {
            console.warn('Invalid latitude or longitude');
            return;
        }
        try {
           const data = await authenticatedApiFetch(
                `${hostname}/weather?latitude=${latitude}&longitude=${longitude}`,
                'GET',
                null,
                "Error fetching weather",
                "Fetching weather..."
            );
            
            setWeatherData(data);
            setLastFetch(Date.now());
            return data;
        } catch (error) {
            console.error('Error fetching weather:', error);
            Logger.error(`Error fetching weather: ${error.message}`, 'WeatherContext', 'fetchWeather');
        }
        return null;
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