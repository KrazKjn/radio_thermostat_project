const db = require('../../db');
const fetch = require("node-fetch");
const arp = require('node-arp');
const snmp = require("net-snmp");
const axios = require("axios");
const { getValidServiceToken } = require('./authService');
const { HVAC_MODE_COOL, HVAC_MODE_HEAT } = require('../../constants/hvac_mode');

// Cache object to store thermostat data by IP
//const { cache, CACHE_LIMIT } = require('./controllers/thermostatController');
const cache = {};
const CACHE_LIMIT = 120; // Limit cache size to 120 entries

const ipToIdMap = {};  // Object to store IP → ID mappings
const uuidToIdMap = {};  // Object to store UUID → ID mappings

// Function to add an entry
function addDeviceByIP(ip, id) {
    ipToIdMap[ip] = id;
}

// Function to get ID by IP
function getIdByIP(ip) {
    if (!ipToIdMap[ip]) {
        const getThermostatIdStmt = db.prepare(`
            SELECT id FROM thermostats WHERE ip = ?;
        `);

        // Fetch thermostat_id from UUID
        const thermostatRow = getThermostatIdStmt.get(ip);
        if (!thermostatRow) {
            console.error("Error: Thermostat not found for IP:", ip);
            return null;
        }
        const thermostat_id = thermostatRow.id;
        addDeviceByIP(ip, thermostat_id);
        return thermostat_id;
    }
    return ipToIdMap[ip] || null;  // Returns ID or null if not found
}

// Function to add an entry
function addDeviceByUUID(uuid, id) {
    uuidToIdMap[uuid] = id;
}

// Function to get ID by UUID
function getIdByUUID(uuid) {
    return uuidToIdMap[uuid] || null;  // Returns ID or null if not found
}

const getThermostatScanMode = (ip) => {
    const getThermostatIdStmt = db.prepare(`
        SELECT scanInterval, scanMode FROM thermostats WHERE ip = ?;
    `);

    const thermostatRow = getThermostatIdStmt.get(ip);
    if (thermostatRow) {
        return [ thermostatRow.scanInterval, thermostatRow.scanMode ];
    }
    return undefined;
}

const updateThermostatScanMode2 = (ip, scanMode) => {
    try {
        // Database insertion
        const stmt = db.prepare(`
            UPDATE thermostats SET scanMode = ? WHERE ip = ?
        `);
        stmt.run(
            scanMode,
            ip
        );

        console.log(`Saved DB data for ${ip}: scanMode: `, scanMode);
        return true;
    } catch (error) {
        console.log(`Error saving DB data for ${ip}: error: `, error);
        return false;
    }
}

const updateThermostatEnabled = (ip, enabled) => {
    try {
        // Database insertion
        const stmt = db.prepare(`
            UPDATE thermostats SET enabled = ? WHERE ip = ?
        `);
        stmt.run(
            enabled,
            ip
        );

        console.log(`Saved DB data for ${ip}: enabled: `, enabled);
        return true;
    } catch (error) {
        console.log(`Error saving DB data for ${ip}: error: `, error);
        return false;
    }
}

async function scannerIntervalTask(ip) {
    try {
        const [ scanInterval, scanMode ] = getThermostatScanMode(ip);
        const thermostat_id = getIdByIP(ip);
        let currentTime = Date.now();
        let data = undefined;
        if (scanMode !== undefined && scanMode === 0) {
            console.error("Error: Thermostat scan mode is 0 (Disabled) for IP:", ip);
            return;
        }
        if (scanMode === undefined || scanMode === 1) {
            // Always get a valid service token
            const token = getValidServiceToken();
            const headers = { "Authorization": `Bearer ${token}` };

            const response = await fetch(`http://localhost:${process.env.PORT || 5000}/tstat/${ip}`, {
                method: "GET",
                headers
            });
            data = await response.json();

            console.log(`Scanned data from ${ip}:`, data);

            // Database insertion
            const stmt = db.prepare(`
                INSERT INTO scan_data (thermostat_id, timestamp, temp, tmode, tTemp, tstate, fstate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run(
                thermostat_id,
                currentTime,
                data.temp,
                data.tmode,
                data.tmode === HVAC_MODE_COOL ? data.t_cool : data.tmode === HVAC_MODE_HEAT ? data.t_heat : null,
                data.tstate,
                data.fstate
            );

            console.log(`Saved DB data for ${ip}:`, data);
        } else {
            const getThermostatDataStmt = db.prepare(`
                SELECT * FROM scan_data WHERE thermostat_id = ? ORDER BY timestamp DESC LIMIT 1;
            `);

            // Fetch thermostat_id from UUID
            const thermostatRow = getThermostatDataStmt.get(thermostat_id);
            const date = new Date(thermostatRow.timestamp);
            const adjustedDay = (date.getDay() + 6) % 7; // Converts Sunday (0) to 6, Monday (1) to 0, etc.
            const formattedTime = {
                day: adjustedDay,
                hour: date.getHours(),
                minute: date.getMinutes()
            };

            // Convert to required format
            data = {
                temp: thermostatRow.temp,
                tmode: thermostatRow.tmode,
                tstate: thermostatRow.tstate,
                fstate: thermostatRow.fstate,
                time: formattedTime,
            };
            currentTime = thermostatRow.timestamp;

            if (thermostatRow.tmode === HVAC_MODE_COOL) {
                data.t_cool = thermostatRow.tTemp; // Use tTemp for cooling mode
            } else if (thermostatRow.tmode === HVAC_MODE_HEAT) {
                data.t_heat = thermostatRow.tTemp; // Use tTemp for heating mode
            }
            console.log(`Queried DB data for ${ip}:`, data);
        }
        cache[ip] = cache[ip] || { values: [] };
        const updatedData = { timestamp: currentTime, ...data };
        cache[ip].values.unshift(updatedData);
        cache[ip].lastUpdated = currentTime;

        if (cache[ip].values.length > CACHE_LIMIT) {
            cache[ip].values.pop();
        }
    } catch (error) {
        console.error(`Error scanning ${ip}:`, error);
    }
}

async function scanSubnet(subnet, timeout = 5000) {
    const results = [];

    console.log(`${Date().toString()}: Scanning for thermostats ...`);
    for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        const mac = await getMacAddress(ip);

        if (mac) {
            let location = undefined;
            console.log(`${Date().toString()}: Scanning device on ${ip}/${mac} ...`);
            if (false) {
                location = await getDeviceName(ip);
                const manufacturer = await lookupMac(mac);
            }
            try {
                const controller = new AbortController();
                const signal = controller.signal;

                // Set a timeout to abort the request
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                let response = await fetch(`http://${ip}/sys/name`, { signal });
                clearTimeout(timeoutId); // Clear the timeout
                let data = await response.json();

                if (data && data.name) {
                    location = data.name;
                    response = await fetch(`http://${ip}/tstat/model`);
                    data = await response.json();
                    model = data.model;
                    manufacturer = "Radio Thermostat"
                    console.log(`${Date().toString()}: Device on ${ip}/${mac} is a Thermostat ...`);
                    results.push({ id: getIdByIP(ip), ip, mac, manufacturer, location, model });
                }
            } catch (error) {
                if (error.name === "AbortError") {
                    console.log(`${Date().toString()}: Timeout checking Device on ${ip}/${mac} ...`);
                } else {
                    console.log(`${Date().toString()}: Device on ${ip}/${mac} is not a Thermostat ...`);
                }
            }
        }
    }
    console.log(`${Date().toString()}: Scanning for thermostats ... Done!`);

    return JSON.stringify(results, null, 2);
}

// Get MAC Address via ARP
async function getMacAddress(ip) {
    return new Promise((resolve) => {
        arp.getMAC(ip, (err, mac) => {
            if (err) {
                resolve(null);
            } else {
                resolve(mac);
            }
        });
    });
}

// Get Device Name via SNMP
async function getDeviceName(ip) {
    const optionsSNMP = {
        timeout: 1000, // Timeout in milliseconds (1 second)
        retries: 2,    // Number of retry attempts
    };
    return new Promise((resolve) => {
        const session = snmp.createSession(ip, "public", optionsSNMP);
        session.get(["1.3.6.1.2.1.1.5.0"], (error, varbinds) => {
            session.close();
            resolve(error ? null : varbinds[0].value.toString());
        });
    });
}

// Lookup MAC Address Manufacturer
async function lookupMac(mac) {
    try {
        const response = await axios.get(`https://api.macvendors.com/${mac}`);
        return response.data;
    } catch (error) {
        return "Unknown Manufacturer";
    }
}


module.exports = {
    getThermostatScanMode,
    updateThermostatScanMode2,
    updateThermostatEnabled,
    scannerIntervalTask,
    scanSubnet,
    getMacAddress,
    getDeviceName,
    lookupMac,
    getIdByIP,
    addDeviceByIP,
    getIdByUUID,
    addDeviceByUUID,
};
