const fetch = require('node-fetch');
const Logger = require('../../components/Logger');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || undefined;

/*
{
  "timelines": {
    "minutely": [
      {
        "time": "2025-10-13T17:53:00Z",
        "values": {
          "altimeterSetting": 29.99,
          "cloudBase": null,
          "cloudCeiling": null,
          "cloudCover": 13,
          "dewPoint": 42.1,
          "evapotranspiration": 0.015,
          "freezingRainIntensity": 0,
          "humidity": 23,
          "iceAccumulation": 0,
          "iceAccumulationLwe": 0,
          "precipitationProbability": 0,
          "pressureSeaLevel": 29.94,
          "pressureSurfaceLevel": 28.63,
          "rainAccumulation": 0,
          "rainIntensity": 0,
          "sleetAccumulation": 0,
          "sleetAccumulationLwe": 0,
          "sleetIntensity": 0,
          "snowAccumulation": 0,
          "snowAccumulationLwe": 0,
          "snowIntensity": 0,
          "temperature": 83.2,
          "temperatureApparent": 80.8,
          "uvHealthConcern": 0,
          "uvIndex": 0,
          "visibility": 9.94,
          "weatherCode": 1100,
          "windDirection": 67,
          "windGust": 9.5,
          "windSpeed": 7.4
        }
      },
        ...
*/
class WeatherService {
    constructor() {
        this.cache = {
            data: null,
            lastFetch: null
        };
    }

    async getWeatherData(latitude, longitude) {
        if (!WEATHER_API_KEY) {
            Logger.warn("WEATHER_API_KEY is not set. Weather data cannot be fetched.", 'WeatherService', 'getWeatherData');
            return null; // Weather API key not configured
        }
        // Check if cache is valid
        if (this.cache.data && this.cache.lastFetch && 
            (Date.now() - this.cache.lastFetch) < CACHE_DURATION) {
            Logger.info("Returning cached weather data.", 'WeatherService', 'getWeatherData');
            return this.cache.data;
        }

        try {
            Logger.info("Fetching new weather data from API.", 'WeatherService', 'getWeatherData');
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
            Logger.error(`Error fetching weather data: ${error.message}`, 'WeatherService', 'getWeatherData');
            throw error;
        }
    }
}

module.exports = new WeatherService();