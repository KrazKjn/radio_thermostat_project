import React, { createContext, useState, useContext, useEffect } from 'react';
import { HostnameContext } from './HostnameContext';
import { useAuth } from './AuthContext';
import DataRefreshContext from './DataRefreshContext';
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
    const { register, unregister } = useContext(DataRefreshContext);

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

    useEffect(() => {
        const listenerId = 'WeatherContext-fetchWeather';
        if (!token) return; // Wait until token is available

        const handleRefresh = () => {
            const now = Date.now();
            if (!lastFetch || (now - lastFetch > WEATHER_REFRESH_MINUTES * 60 * 1000)) {
                Logger.info('Fetching new weather data.', 'WeatherContext', 'handleRefresh');
                fetchWeather();
            }
        };

        handleRefresh(); // Initial fetch
        register(listenerId, handleRefresh);

        return () => unregister(listenerId);
    }, [hostname, token, register, unregister, lastFetch]); // Re-run when token updates

    return (
        <WeatherContext.Provider value={{ weatherData, lastFetch, fetchWeather }}>
            {children}
        </WeatherContext.Provider>
    );
};

export const useWeather = () => useContext(WeatherContext);