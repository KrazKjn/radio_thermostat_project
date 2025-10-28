const mqtt = require('mqtt');
const db = require('../db');
require("dotenv").config();

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const MQTT_OPTIONS = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    protocol: process.env.MQTT_USE_SSL === 'true' ? 'mqtts' : 'mqtt'
};

const client = mqtt.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    initializeSubscriptions();
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        if (payload.method === 'NotifyStatus' && payload.params && payload.params.ts && payload.params['temperature:0'] && payload.params['humidity:0']) {
            const shelly_device_id = topic.split('/')[0];
            const temp = payload.params['temperature:0'].tC;
            const humidity = payload.params['humidity:0'].rh;

            const getThermostatIdStmt = db.prepare('SELECT thermostat_id FROM shelly_sensors WHERE shelly_device_id = ?');
            const sensor = getThermostatIdStmt.get(shelly_device_id);

            if (sensor) {
                const updateStmt = db.prepare(`
                    UPDATE scan_data
                    SET temp = ?, humidity = ?
                    WHERE id = (SELECT id FROM scan_data WHERE thermostat_id = ? ORDER BY timestamp DESC LIMIT 1)
                `);
                updateStmt.run(temp, humidity, sensor.thermostat_id);
                console.log(`Updated sensor data for thermostat ID ${sensor.thermostat_id}`);
            } else {
                console.warn(`No thermostat found for Shelly device ID: ${shelly_device_id}`);
            }
        }
    } catch (error) {
        console.error('Error handling MQTT message:', error);
    }
});

const initializeSubscriptions = () => {
    try {
        const stmt = db.prepare('SELECT shelly_device_id FROM shelly_sensors');
        const sensors = stmt.all();
        sensors.forEach(sensor => {
            if (sensor.shelly_device_id) {
                const topic = `${sensor.shelly_device_id}/events/rpc`;
                client.subscribe(topic, (err) => {
                    if (!err) {
                        console.log(`Subscribed to ${topic}`);
                    } else {
                        console.error(`Failed to subscribe to ${topic}:`, err);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error initializing MQTT subscriptions:', error);
    }
};

const initialize = () => {
    // The 'connect' event will trigger the subscriptions
};

module.exports = {
    initialize
};
