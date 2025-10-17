import React, { createContext, useState, useContext, useEffect } from 'react';
import { HostnameContext } from './HostnameContext';
import { useAuth } from './AuthContext';
import apiFetch from '../utils/apiFetch';

const Logger = require('../components/Logger');
const WeatherContext = createContext();
const WEATHER_LATITUDE = 29.8238;
const WEATHER_LONGITUDE = -90.4751;
const WEATHER_REFRESH_MINUTES = 5;

export const WeatherProvider = ({ children }) => {
    const [weatherData, setWeatherData] = useState(null);
    const [lastFetch, setLastFetch] = useState(null);
    const hostname = useContext(HostnameContext);
    const { token, authenticatedApiFetch } = useAuth();

    const fetchWeather = async (latitude, longitude) => {
        if (!latitude) latitude = WEATHER_LATITUDE;
        if (!longitude) longitude = WEATHER_LONGITUDE;
        if (!latitude || !longitude) {
            console.warn('Invalid latitude or longitude');
            return;
        }
        if (!token) {
            Logger.warn('Skipping weather fetch: token not available', 'WeatherContext', 'fetchWeather');
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
        if (!token) return; // Wait until token is available

        fetchWeather(); // Initial fetch

        const interval = setInterval(() => {
            fetchWeather();
        }, WEATHER_REFRESH_MINUTES * 60 * 1000);

        return () => clearInterval(interval);
    }, [hostname, token]); // Re-run when token updates

    return (
        <WeatherContext.Provider value={{ weatherData, lastFetch, fetchWeather }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);