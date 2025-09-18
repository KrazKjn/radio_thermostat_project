const fetch = require('node-fetch');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || undefined;

class WeatherService {
    constructor() {
        this.cache = {
            data: null,
            lastFetch: null
        };
    }

    async getWeatherData(latitude, longitude) {
        if (!WEATHER_API_KEY) {
            console.warn("WEATHER_API_KEY is not set. Weather data cannot be fetched.");
            return null; // Weather API key not configured
        }
        // Check if cache is valid
        if (this.cache.data && this.cache.lastFetch && 
            (Date.now() - this.cache.lastFetch) < CACHE_DURATION) {
            console.log("Returning cached weather data.");
            return this.cache.data;
        }

        try {
            console.log("Fetching new weather data from API.");
            // Fetch new data from the weather API
            const response = await fetch(
                `https://api.tomorrow.io/v4/weather/forecast?location=${latitude},${longitude}&units=imperial&apikey=${WEATHER_API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error('Weather API request failed');
            }

            const data = await response.json();
            
            // Update cache
            this.cache = {
                data,
                lastFetch: Date.now()
            };

            return data;
        } catch (error) {
            console.error('Error fetching weather data:', error);
            throw error;
        }
    }
}

module.exports = new WeatherService();