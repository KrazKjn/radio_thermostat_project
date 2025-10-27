const mqtt = require('mqtt');
const db = require('../db');

const MQTT_BROKER = 'mqtt://localhost:1883'; // Replace with your broker's address
const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    initialize(); // Subscribe to topics after connecting
});

client.on('message', (topic, message) => {
    console.log(`Received message on topic ${topic}: ${message.toString()}`);
    try {
        const payload = JSON.parse(message.toString());
        const { temperature, humidity } = payload;

        if (temperature !== undefined && humidity !== undefined) {
            const getThermostatIdStmt = db.prepare('SELECT thermostat_id FROM shelly_sensors WHERE mqtt_topic = ?');
            const sensor = getThermostatIdStmt.get(topic);

            if (sensor) {
                const stmt = db.prepare('INSERT INTO scan_data (thermostat_id, timestamp, temp, humidity) VALUES (?, ?, ?, ?)');
                stmt.run(sensor.thermostat_id, Date.now(), temperature, humidity);
                console.log(`Inserted sensor data for thermostat ID ${sensor.thermostat_id}`);
            } else {
                console.warn(`No thermostat found for MQTT topic: ${topic}`);
            }
        }
    } catch (error) {
        console.error('Error handling MQTT message:', error);
    }
});

const initialize = () => {
    try {
        const stmt = db.prepare('SELECT mqtt_topic FROM shelly_sensors');
        const sensors = stmt.all();
        sensors.forEach(sensor => {
            if (sensor.mqtt_topic) {
                client.subscribe(sensor.mqtt_topic, (err) => {
                    if (!err) {
                        console.log(`Subscribed to ${sensor.mqtt_topic}`);
                    } else {
                        console.error(`Failed to subscribe to ${sensor.mqtt_topic}:`, err);
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error initializing MQTT subscriptions:', error);
    }
};

module.exports = {
    initialize
};
