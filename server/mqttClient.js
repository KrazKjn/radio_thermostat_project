const mqtt = require('mqtt');
const db = require('../db');
const Logger = require('../components/Logger');

require("dotenv").config();

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL && process.env.MQTT_BROKER_PORT
  ? `${process.env.MQTT_BROKER_URL}:${process.env.MQTT_BROKER_PORT}`
  : 'mqtt://localhost:1883';
const MQTT_OPTIONS = {
  clientId: process.env.MQTT_CLIENT_ID || 'thermostat-server',
  protocol: process.env.MQTT_USE_SSL === 'true' ? 'mqtts' : 'mqtt',
  keepalive: Number(process.env.MQTT_KEEPALIVE) || 60,
  reconnectPeriod: Number(process.env.MQTT_RECONNECT_PERIOD) || 1000,
  clean: true
};

// Conditionally add username and password
if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
  MQTT_OPTIONS.username = process.env.MQTT_USERNAME;
  MQTT_OPTIONS.password = process.env.MQTT_PASSWORD;
}

const UPDATE_LAST_MINUTES = Number(process.env.MQTT_CYCLE_MINUTES) || 10;

const client = mqtt.connect(MQTT_BROKER_URL, MQTT_OPTIONS);

client.on('connect', () => {
    Logger.info('Connected to MQTT broker', 'mqttClient', 'connect');
    initializeSubscriptions();
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        Logger.debug(`Received MQTT message on topic ${topic}: ${JSON.stringify(payload)}`, 'mqttClient', 'message', 2);
        if (
            (payload.method === 'NotifyStatus' || payload.method === 'NotifyFullStatus') &&
            payload.params &&
            payload.params.ts &&
            payload.params['temperature:0'] &&
            payload.params['humidity:0']
        ) {
            const shelly_device_id = topic.split('/')[0];
            const tempC = payload.params['temperature:0'].tC;
            const tempF = payload.params['temperature:0'].tF;
            const humidity = payload.params['humidity:0'].rh;

            const getThermostatIdStmt = db.prepare('SELECT thermostat_id FROM shelly_sensors WHERE shelly_device_id = ?');
            const sensor = getThermostatIdStmt.get(shelly_device_id);

            if (sensor) {
                const now = Date.now(); // current UNIX timestamp
                const minutesAgo = now - (UPDATE_LAST_MINUTES * 60 * 1000);

                const selectStmt = db.prepare(`
                    SELECT id FROM scan_data
                    WHERE thermostat_id = ?
                    AND humidity IS NULL
                    AND timestamp >= ?
                `);
                const rowsToUpdate = selectStmt.all(sensor.thermostat_id, minutesAgo);

                if (rowsToUpdate.length > 0) {
                    const updateStmt = db.prepare(`UPDATE scan_data SET humidity = ? WHERE id = ?`);
                    for (const row of rowsToUpdate) {
                        updateStmt.run(humidity, row.id);
                        Logger.info(`Humidity updated: [${humidity}] for scan_data ID ${row.id}`, 'mqttClient', 'update');
                    }
                } else {
                    Logger.debug(`No scan_data rows with NULL humidity in the last 10 minutes for thermostat_id ${sensor.thermostat_id}`, 'mqttClient', 'update');
                }
            } else {
                Logger.warn(`No thermostat found for Shelly device ID: ${shelly_device_id}`, 'mqttClient', 'message');
            }
        }
    } catch (error) {
        Logger.error('Error handling MQTT message:', error, 'mqttClient', 'message');
    }
});

client.on('reconnect', () => {
  Logger.info(`Reconnecting to MQTT broker at ${MQTT_BROKER_URL} with client ID ${MQTT_OPTIONS.clientId}`, 'mqttClient', 'reconnect');
});
client.on('close', () => {
  Logger.warn(`MQTT connection closed. Broker: ${MQTT_BROKER_URL}, Client ID: ${MQTT_OPTIONS.clientId}, Keepalive: ${MQTT_OPTIONS.keepalive}`, 'mqttClient', 'close');
});
client.on('offline', () => {
  Logger.warn(`MQTT client is offline. Last known broker: ${MQTT_BROKER_URL}, reconnecting in ${MQTT_OPTIONS.reconnectPeriod}ms`, 'mqttClient', 'offline');
});
client.on('error', (err) => {
  Logger.error(`MQTT error: ${err.message}. Broker: ${MQTT_BROKER_URL}, Client ID: ${MQTT_OPTIONS.clientId}, Options: ${JSON.stringify(MQTT_OPTIONS)}`, 'mqttClient', 'error');
});

const initializeSubscriptions = () => {
    try {
        Logger.info('Initializing MQTT subscriptions...', 'mqttClient', 'initializeSubscriptions');
        const stmt = db.prepare('SELECT shelly_device_id FROM shelly_sensors');
        const sensors = stmt.all();
        Logger.debug(`Found ${sensors.length} sensors to subscribe to.`, 'mqttClient', 'initializeSubscriptions', 2);
        sensors.forEach(sensor => {
            if (sensor.shelly_device_id) {
                const topic = `${sensor.shelly_device_id}/events/rpc`;
                client.subscribe(topic, (err) => {
                    if (!err) {
                        Logger.info(`Subscribed to ${topic}`, 'mqttClient', 'subscribe');
                    } else {
                        Logger.error(`Failed to subscribe to ${topic}:`, err, 'mqttClient', 'subscribe');
                    }
                });
            }
        });
        Logger.info('MQTT subscriptions initialized.', 'mqttClient', 'initializeSubscriptions');
    } catch (error) {
        Logger.error('Error initializing MQTT subscriptions:', error, 'mqttClient', 'initializeSubscriptions');
    }
};

const initialize = () => {
    // The 'connect' event will trigger the subscriptions
    Logger.info('Initializing MQTT client...', 'mqttClient', 'initialize');
    Logger.debug(`Connecting to MQTT broker at ${MQTT_BROKER_URL}`, 'mqttClient', 'initialize', 2);
    Logger.debug(`MQTT Options: ${JSON.stringify(MQTT_OPTIONS)}`, 'mqttClient', 'initialize', 2);
};

module.exports = {
    initialize
};
