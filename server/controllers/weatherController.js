const weatherService = require('../services/weatherService');

const getWeather = async (req, res) => {
    try {
        const { latitude, longitude } = req.query;
        if (!latitude || !longitude) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const data = await weatherService.getWeatherData(latitude, longitude);
        res.json(data);
    } catch (error) {
        console.error('Weather controller error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
};

module.exports = { getWeather };