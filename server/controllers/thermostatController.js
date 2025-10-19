const fetch = require("node-fetch");
const db = require('../../db');
const { getThermostatScanMode, updateThermostatScanMode2, updateThermostatEnabled, scannerIntervalTask, scanSubnet, addDeviceByUUID } = require('../services/thermostatService');
const weatherService = require('../services/weatherService');
const { convertToTwoDecimalFloat, formatTimestamp } = require('../utils/utils');
const { HVAC_MODE_COOL, HVAC_MODE_HEAT } = require('../../constants/hvac_mode');
const { HVAC_SCAN_CLOUD } = require('../../constants/hvac_scan');
const crypto = require('../utils/crypto');
const Logger = require('../../components/Logger');

const cache = {};
const CACHE_LIMIT = 120; // Limit cache size to 120 entries
const CACHE_EXPIRATION = 15000; // 15 seconds
const DEFAULT_SCAN_INTERVAL = 60000; // Scan every 15 seconds
const scanners = {}; // Store active scanners by IP
const daysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

let lastSegmentUpdate = 0;
const SEGMENT_INTERVAL_MS = 60000; // 1 minute or whatever cadence you prefer

const getThermostatData = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getThermostatData');
        ip = req.params.ip;
        const currentTime = Date.now();
        const noCache = req.query.noCache === "true"; // Check for cache override
        let expiredData = false;

        cache[ip] = cache[ip] || { values: [] };
        if (typeof cache[ip].lastUpdated === "number") {
            expiredData = currentTime - cache[ip].lastUpdated < CACHE_EXPIRATION;
        }
        if (cache[ip].source !== 'cloud') {
            expiredData = currentTime - cache[ip].lastUpdated < (DEFAULT_SCAN_INTERVAL + CACHE_EXPIRATION);
        }
        // Use cached data if it's recent and cache override is NOT requested
        if (!noCache &&
            cache[ip]?.values?.length &&
            expiredData) {
            Logger.info(`[Thermostat] Returning cached data for IP ${ip}`, 'ThermostatController', 'getThermostatData');
            return res.json(cache[ip].values[0]); // Return the most recent cached value
        }
        Logger.debug(`[Thermostat] Fetching new data for IP ${ip}`, 'ThermostatController', 'getThermostatData', 1);
        const lastUpdated = cache[ip]?.lastUpdated;
        const lastUpdatedDate = lastUpdated ? new Date(lastUpdated) : null;
        const timeSinceLastUpdate = lastUpdated ? currentTime - lastUpdated : null;

        Logger.debug(
            `[Thermostat] noCache: ${noCache}, cache exists: ${!!cache[ip]}, cache length: ${cache[ip]?.values?.length}, ` +
            `lastUpdated: ${lastUpdatedDate?.toString() ?? 'N/A'}, currentTime: ${new Date(currentTime).toString()}, ` +
            `time since last update: ${timeSinceLastUpdate !== null ? timeSinceLastUpdate + 'ms' : 'N/A'}`,
            'ThermostatController',
            'getThermostatData',
            1
        );        

        // Fetch new data
        const response = await fetch(`http://${ip}/tstat`);
        const data = await response.json();

        // Update cache
        cache[ip] = cache[ip] || { values: [] };
        if (cache[ip].source !== 'cloud') {
            Logger.debug(`[Thermostat] Updating cached data for IP ${ip}`, 'ThermostatController', 'getThermostatData');
            const [ scanInterval, scanMode ] = getThermostatScanMode(ip);
            data.scanMode = scanMode;
            data.scanInterval = scanInterval;
            const updatedData = { timestamp: currentTime, ...data }
            cache[ip].values.unshift(updatedData); // Add new value to the start
            cache[ip].lastUpdated = currentTime;

            // Limit cache size
            if (cache[ip].values.length > CACHE_LIMIT) {
                cache[ip].values.pop(); // Remove oldest value
            }
        }

        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getThermostatData', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error fetching data for IP ${ip}: ${error.message}`, 'ThermostatController', 'getThermostatData');
        res.status(500).json({ error: "Failed to retrieve thermostat data" });
    }
};

const updateThermostat = async (req, res) => {
    Logger.info(`Received POST request: ${req.url}`); // Log the request body
    Logger.debug("Request Body:", 'ThermostatController', 'updateThermostat', 2);
    const { tmode, temperature, time, fmode, hold, override } = req.body; // Get values from request
    const { ip } = req.params; // Get ip from request parameters
    // Validate request body
    if (!ip) {
        Logger.warn("IP address is missing in the request parameters.", 'ThermostatController', 'updateThermostat');
        return res.status(400).json({ error: "Missing target ip address" });
    }
    if (!time) {
        if (tmode === undefined && fmode === undefined && hold === undefined && override === undefined) {
            Logger.warn("time, tmode, fmode, hold, and override are all missing in the request body. One is required.", 'ThermostatController', 'updateThermostat');
            return res.status(400).json({ error: "Missing required fields: tmode, fmode, hold, override" });
        }
    }

    const payload = {
        tmode: tmode === undefined ? undefined : Number(tmode), // ? Only set tmode if provided
        fmode: fmode === undefined ? undefined : Number(fmode), // ? Only set fmode if provided
        time: time || undefined, // ? Only set time if provided
        ...(tmode === HVAC_MODE_HEAT && temperature ? { t_heat: Number(temperature) } : {}),
        ...(tmode === HVAC_MODE_COOL && temperature ? { t_cool: Number(temperature) } : {}),
        hold: hold === undefined ? undefined : Number(hold), // ? Only set hold if provided
        override: override === undefined ? undefined : Number(override) // ? Only set override if provided
    };
    Logger.debug(`POST body: ${JSON.stringify(payload, null, 2)}`, 'ThermostatController', 'updateThermostat', 2); // Log the post body

    try {
        const response = await fetch(`http://${ip}/tstat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
  
        const data = await response.json();

        // Ensure the token is passed when updating the cache
        const response2 = await fetch(`http://localhost:${process.env.PORT || 5000}/tstat/${ip}?noCache=true`, {
            method: "GET",
            headers: { 
                "Authorization": req.headers.authorization // Include the token
            }
        });

        const data2 = await response2.json();

        Logger.debug(`Received POST response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'updateThermostat', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error Updating for IP ${ip}: ${error.message}`, 'ThermostatController', 'updateThermostat');
        res.status(500).json({ error: "Failed to update thermostat settings" });
    }
};

const getCache = (req, res) => {
    const ip = req.params.ip;
    if (!cache[ip]) {
        return res.status(404).json({ error: "No cached data found for this IP" });
    }
    res.json(cache[ip].values);
};

const getModel = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getModel', 1);
        ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/model`);
        const data = await response.json();
        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getModel', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error getting model for IP ${ip}: ${error.message}`, 'ThermostatController', 'getModel');
        res.status(500).json({ error: "Failed to retrieve thermostat model/version data" });
    }
};

const getName = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getName', 1);
        ip = req.params.ip;
        const response = await fetch(`http://${ip}/sys/name`);
        const data = await response.json();
        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getName', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error getting name for IP ${ip}: ${error.message}`, 'ThermostatController', 'getName');
        res.status(500).json({ error: "Failed to retrieve thermostat name data" });
    }
};

const getSwing = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getSwing', 1);
        ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/tswing`);
        const data = await response.json();
        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getSwing', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error getting swing for IP ${ip}: ${error.message}`, 'ThermostatController', 'getSwing');
        res.status(500).json({ error: "Failed to retrieve thermostat swing data" });
    }
};

const getThermostat = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getThermostat', 1);
        ip = req.params.ip;
        const endpoints = {
            model: `http://${ip}/tstat/model`,
            name: `http://${ip}/sys/name`,
        };
        let combinedData = {};
        Logger.debug(`Invoking:  ${ JSON.stringify(endpoints, null, 2)}`, 'ThermostatController', 'getThermostat', 2);
        if (ip.includes("192.168.100")) {
            combinedData = {
                ip: "192.168.100.10",
                model: "CT50",
                name: "Test Location",
            };
        } else {
            // Fetch data from both endpoints in parallel
            const [modelResponse, nameResponse] = await Promise.all([
                fetch(endpoints.model).then(res => res.json()),
                fetch(endpoints.name).then(res => res.json()),
            ]);
            
            // Consolidate into a single JSON object
            combinedData = {
                ip,
                model: modelResponse.model,
                name: nameResponse.name,
            };
        }
        res.json(combinedData);
    } catch (error) {
        Logger.error(`[Thermostat] Error fetching data for IP ${ip}: ${error.message}`, 'ThermostatController', 'getThermostat');
        res.status(500).json({ error: "Failed to retrieve thermostat data", details: error.message });
    }
};

const getThermostatDetailed = async (req, res) => {
    let ip = undefined;
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getThermostatDetailed', 1);
        ip = req.params.ip;
        const endpoints = {
            model: `http://${ip}/tstat/model`,
            name: `http://${ip}/sys/name`,
            sys: `http://${ip}/sys`,
            cloud: `http://${ip}/cloud`,
        };
        let combinedData = {};
        Logger.debug(`Invoking: ${ JSON.stringify(endpoints, null, 2) }`, 'ThermostatController', 'getThermostatDetailed', 2);
        if (ip.includes("192.168.100")) {
            combinedData = {
                id: null,
                ip: "192.168.100.10",
                model: "CT50",
                name: "Test Location",
                sys: {"uuid":"3A7F92BCD5E8","api_version":113,"fw_version":"1.04.84","wlan_fw_version":"v10.105576"},
                cloud: {"interval":60,"url":"http://192.168.0.101:3000/captureStatIn","status":2,"enabled":0,"authkey":"beaa4c96","status_code":200}
            };
        } else {
            // Fetch data from both endpoints in parallel
            const [modelResponse, nameResponse] = await Promise.all([
                fetch(endpoints.model).then(res => res.json()),
                fetch(endpoints.name).then(res => res.json()),
                fetch(endpoints.sys).then(res => res.json()),
                fetch(endpoints.cloud).then(res => res.json()),
            ]);
            
            // Consolidate into a single JSON object
            combinedData = {
                id: getIdByIP(ip),
                ip,
                model: modelResponse.model,
                name: nameResponse.name,
                sys: sysResponse,
                cloud: cloudResponse
            };
        }
        res.json(combinedData);
    } catch (error) {
        Logger.error(`[Thermostat] Error fetching data for IP ${ip}: ${error.message}`, 'ThermostatController', 'getThermostatDetailed');
        res.status(500).json({ error: "Failed to retrieve thermostat data", details: error.message });
    }
};

const getSchedule = async (req, res) => {
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getSchedule', 1);

        const ip = req.params.ip;
        let scheduleMode = req.params.scheduleMode.toLowerCase(); // Ensure case insensitivity

        // Validate scheduleMode
        if (!["cool", "heat"].includes(scheduleMode)) {
            Logger.error("Invalid schedule mode. Use 'cool' or 'heat'.", 'ThermostatController', 'getSchedule');
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        Logger.debug(`Invoking: http://${ip}/tstat/program/${scheduleMode}`, 'ThermostatController', 'getSchedule', 2);

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}`);
        if (!response.ok) throw new Error("Failed to fetch data from thermostat");

        const data = await response.json();
        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getSchedule', 1);
        res.json(data);
    } catch (error) {
        console.error("Error:", error);
        Logger.error(`Error retrieving thermostat schedule data: ${error.message}`, 'ThermostatController', 'getSchedule');
        res.status(500).json({ error: "Failed to retrieve thermostat schedule data" });
    }
};

const getCloud = async (req, res) => {
    try {
        Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getCloud', 1);

        const ip = req.params.ip;
        Logger.debug(`Invoking: http://${ip}/cloud`, 'ThermostatController', 'getCloud', 2);

        const response = await fetch(`http://${ip}/cloud`);
        if (!response.ok) throw new Error("Failed to fetch data from thermostat");

        const data = await response.json();

        const [ scanInterval, scanMode ] = getThermostatScanMode(ip);
        data.scanMode = scanMode;
        data.scanInterval = scanInterval;
        if (cache[ip] && 'source' in cache[ip]) {
            data.source = cache[ip].source;
        }

        Logger.debug(`Received GET response: ${req.url}: ${Logger.formatJSON(data)}`, 'ThermostatController', 'getCloud', 1);
        res.json(data);
    } catch (error) {
        console.error("Error:", error);
        Logger.error(`Error retrieving thermostat cloud data: ${error.message}`, 'ThermostatController', 'getCloud');
        res.status(500).json({ error: "Failed to retrieve thermostat cloud data" });
    }
};

const updateName = async (req, res) => {
    Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'updateName', 1);
    const { name } = req.body; // Get values from request
    const { ip } = req.params;
    // Validate request body
    if (!name) {
        return res.status(400).json({ error: "Missing new name" });
    }
    const payload = {
      name: name
    };
    Logger.debug(`POST body: ${JSON.stringify(payload, null, 2)}`, 'ThermostatController', 'updateName');

    try {
        const response = await fetch(`http://${ip}/sys/name`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
  
        const data = await response.json();
        Logger.debug(`POST response: ${Logger.formatJSON(data)}`, 'ThermostatController', 'updateName', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error updating name for IP ${ip}: ${error.message}`, 'ThermostatController', 'updateName');
        res.status(500).json({ error: "Failed to update thermostat name" });
    }
};

const rebootServer = async (req, res) => {
    Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'rebootServer', 1);
    const { ip } = req.params;

    const payload = {
      command: "reboot"
    };
    Logger.debug(`POST body: ${JSON.stringify(payload, null, 2)}`, 'ThermostatController', 'rebootServer');

    try {
        const response = await fetch(`http://${ip}/sys/command`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        Logger.debug(`POST response: ${Logger.formatJSON(data)}`, 'ThermostatController', 'rebootServer', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error rebooting thermostat for IP ${ip}: ${error.message}`, 'ThermostatController', 'rebootServer');
        res.status(500).json({ error: "Failed to reboot thermostat" });
    }
};

const updateSwing = async (req, res) => {
    Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'updateSwing', 1);
    const { tswing } = req.body; // Get values from request
    const { ip } = req.params;
    // Validate request body
    if (!tswing) {
        return res.status(400).json({ error: "Missing new tswing value" });
    }
    const payload = {
        tswing: convertToTwoDecimalFloat(tswing)
    };
    Logger.debug(`POST body: ${JSON.stringify(payload, null, 2)}`, 'ThermostatController', 'updateSwing');

    try {
        const response = await fetch(`http://${ip}/tstat/tswing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
  
        const data = await response.json();
        Logger.debug(`POST response: ${Logger.formatJSON(data)}`, 'ThermostatController', 'updateSwing', 1);
        res.json(data);
    } catch (error) {
        Logger.error(`[Thermostat] Error updating tswing for IP ${ip}: ${error.message}`, 'ThermostatController', 'updateSwing');
        res.status(500).json({ error: "Failed to update thermostat tswing" });
    }
};

const updateSchedule = async (req, res) => {
    try {
        Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'updateSchedule', 1);

        const ip = req.params.ip;
        let scheduleMode = req.params.scheduleMode.toLowerCase(); // Ensure case insensitivity
        //const data = `{ "${day}": ${JSON.stringify(req.body)} }`; // Get values from request
        const data = JSON.stringify(
            req.body.reduce((acc, dayArray, index) => {
                acc[index] = dayArray; // Map each day's array to the correct day index
                return acc;
            }, {})
        );

        // Validate scheduleMode
        if (!["cool", "heat"].includes(scheduleMode)) {
            Logger.error("Invalid schedule mode. Use 'cool' or 'heat'.", 'ThermostatController', 'updateSchedule');
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        Logger.debug(`Invoking: http://${ip}/tstat/program/${scheduleMode}`, 'ThermostatController', 'updateSchedule', 2);

        // Validate request body
        if (!data) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            Logger.debug(`POST body: ${data}`, 'ThermostatController', 'updateSchedule');
        } catch {}

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        });
    
        const respData = await response.json();
        Logger.debug(`POST response: ${Logger.formatJSON(respData)}`, 'ThermostatController', 'updateSchedule', 1);
        res.json(respData);
    } catch (error) {
        console.error("Error: ", error);
        Logger.error(`Error updating thermostat schedule data: ${error.message}`, 'ThermostatController', 'updateSchedule');
        res.status(500).json({ error: "Failed to update thermostat schedule data" });
    }
};

const updateScheduleDay = async (req, res) => {
    try {
        Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'updateScheduleDay', 1);

        const ip = req.params.ip;
        let scheduleMode = req.params.scheduleMode.toLowerCase(); // Ensure case insensitivity
        const day = Number(req.params.day);
        const data = `{ "${day}": ${JSON.stringify(req.body)} }`; // Get values from request

        // Validate scheduleMode
        if (!["cool", "heat"].includes(scheduleMode)) {
            Logger.error("Invalid schedule mode. Use 'cool' or 'heat'.", 'ThermostatController', 'updateScheduleDay');
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        Logger.debug(`Invoking: http://${ip}/tstat/program/${scheduleMode}/${day}`, 'ThermostatController', 'updateScheduleDay', 2);

        // Validate request body
        if (!data) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            Logger.debug(`POST body: ${data}`, 'ThermostatController', 'updateScheduleDay');
        } catch {}

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}/${daysOfWeek[day]}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        });
    
        const respData = await response.json();
        Logger.debug(`POST response: ${Logger.formatJSON(respData)}`, 'ThermostatController', 'updateScheduleDay', 1);
        res.json(respData);
    } catch (error) {
        console.error("Error: ", error);
        Logger.error(`Error updating thermostat schedule data: ${error.message}`, 'ThermostatController', 'updateScheduleDay');
        res.status(500).json({ error: "Failed to update thermostat schedule data" });
    }
};

const updateCloud = async (req, res) => {
    try {
        Logger.debug(`Received POST request: ${req.url}`, 'ThermostatController', 'updateCloud', 1);

        const ip = req.params.ip;

        Logger.debug(`Invoking: http://${ip}/cloud`, 'ThermostatController', 'updateCloud', 2);

        // Validate request body
        if (!req.body) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            Logger.debug(`POST body: ${JSON.stringify(req.body, null, 2)}`, 'ThermostatController', 'updateCloud', 3);
        } catch {}

        if (req.body.scanMode !== undefined) {
            req.body.enabled = req.body.scanMode === HVAC_SCAN_CLOUD ? 1 : 0; // Enable cloud if scanMode is HVAC_SCAN_CLOUD

            updateThermostatScanMode2(ip, req.body.scanMode);
        }
        const payload = {
            interval: req.body.interval || 60, // Default to 60 seconds if not provided
            url: req.body.url || "",
            status: req.body.status || 2,
            enabled: req.body.enabled || 0, // Default to 0 if not provided
            authkey: req.body.authkey || "", // Default to empty string if not provided
            status_code: req.body.status_code || 200
        };

        const response = await fetch(`http://${ip}/cloud`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload).replace(", ", ",")
        });
    
        const respData = await response.text();
        Logger.debug(`POST response: ${respData}`, 'ThermostatController', 'updateCloud', 1);
        res.json(respData);
    } catch (error) {
        console.error("Error: ", error);
        Logger.error(`Error updating thermostat cloud data: ${error.message}`, 'ThermostatController', 'updateCloud');
        res.status(500).json({ error: "Failed to update thermostat cloud data" });
    }
};

const startScanner = (req, res) => {
    const { ip } = req.params;
    const interval = req.body.interval || DEFAULT_SCAN_INTERVAL;

    if (scanners[ip]) {
        return res.status(400).json({ error: `Scanner for ${ip} is already running.` });
    }

    scanners[ip] = setInterval(async () => {
        try {
            await scannerIntervalTask(ip);
        } catch (error) {
            console.error(`Error in scanner interval task for ${ip}:`, error);
            Logger.error(`Error in scanner interval task for ${ip}: ${error.message}`, 'ThermostatController', 'startScanner');
        }
    }, interval);
    Logger.info(`Scanner started for ${ip}: ${interval / 1000} seconds interval`, 'ThermostatController', 'startScanner');

    res.json({ message: `Scanner started for ${ip}.` });
};

const stopScanner = (req, res) => {
    const { ip } = req.params;

    if (!scanners[ip]) {
        return res.status(400).json({ error: `No scanner is running for ${ip}.` });
    }

    clearInterval(scanners[ip]);
    delete scanners[ip];

    res.json({ message: `Scanner stopped for ${ip}.` });
};

const getScannerStatus = (req, res) => {
    const { ip } = req.query;

    if (ip) {
        if (scanners[ip]) {
            return res.json({ ip, interval: scanners[ip]._idleTimeout });
        } else {
            return res.status(404).json({ error: `No scanner is running for IP ${ip}.` });
        }
    }

    // Return all active scanners if no IP is provided
    const scannerDetails = Object.keys(scanners).map((ip) => ({
        ip,
        interval: scanners[ip]._idleTimeout,
    }));
    res.json({ activeScanners: scannerDetails });
};

function getScannerDataByIp(ip) {
    if (!cache[ip]) {
        Logger.warn(`[Thermostat] No cached data for IP ${ip}. Initializing empty array.`, 'ThermostatController', 'getScannerDataByIp');
        cache[ip] = [];
    }

    if (!cache[ip].values || cache[ip].values.length < CACHE_LIMIT) {
        const totalRows = db.prepare(`
            SELECT COUNT(*) as count FROM thermostat_readings WHERE ip = ?;
        `).get(ip).count;

        const queryStatement = `
            SELECT datetime(timestamp / 1000, 'unixepoch') AS formatted_date, *
            FROM thermostat_readings
            WHERE ip = '${ip}'
              AND timestamp >= strftime('%s','now','-${CACHE_LIMIT} minutes') * 1000
            ORDER BY timestamp DESC
            LIMIT ${CACHE_LIMIT}
        `;
        const rows = db.prepare(`
            SELECT datetime(timestamp / 1000, 'unixepoch') AS formatted_date, *
            FROM thermostat_readings
            WHERE ip = ? 
              AND timestamp >= strftime('%s','now','-${CACHE_LIMIT} minutes') * 1000
            ORDER BY timestamp DESC
            LIMIT ${CACHE_LIMIT}
        `).all(ip);

        const dbInfo = db.prepare('PRAGMA database_list').get();
        Logger.debug(`Full database path: ${dbInfo.file}`, 'ThermostatController', 'getScannerDataByIp', 1);
        Logger.debug(`Executing query: ${queryStatement}`, 'ThermostatController', 'getScannerDataByIp', 1);
        Logger.debug(`Fetched ${rows.length} rows out of ${totalRows} total rows for IP ${ip}.`, 'ThermostatController', 'getScannerDataByIp', 1);

        cache[ip].values = rows.map(row => {
            const entry = {
                timestamp: row.timestamp,
                temp: row.temp,
                tmode: row.tmode,
                fmode: 0,
                override: 0,
                hold: 0,
                tstate: row.tstate,
                fstate: row.fstate,
                t_type_post: 0,
                time: formatTimestamp(row.timestamp),
                formatted_date: row.formatted_date,
                outdoor_temp: row.outdoor_temp,
                cloud_cover: row.cloud_cover,
                rainAccumlation: row.rainAccumaltion,
                rainIntensity: row.rainIntensity
            };

            if (row.tmode === HVAC_MODE_COOL) {
                entry.t_cool = row.tTemp;
            }

            if (row.tmode === HVAC_MODE_HEAT) {
                entry.t_heat = row.tTemp;
            }

            return entry;
        });
    }

    return cache[ip].values;
}

const getScannerData = (req, res) => {
    const { ip } = req.params;
    const data = getScannerDataByIp(ip);
    res.json(data);
};

const getScannerDetails = (req, res) => {
    const scannerDetails = Object.keys(scanners).map((ip) => ({
        ip,
        interval: scanners[ip]._idleTimeout,
    }));

    res.json({ activeScanners: scannerDetails });
};

const restartScanner = (req, res) => {
    const { ip } = req.params;
    const interval = req.body.interval || DEFAULT_SCAN_INTERVAL;

    if (scanners[ip]) {
        clearInterval(scanners[ip]);
        delete scanners[ip];
    }

    scanners[ip] = setInterval(async () => {
        try {
            await scannerIntervalTask(ip);
        } catch (error) {
            console.error(`Error in scanner interval task for ${ip}:`, error);
            Logger.error(`Error in scanner interval task for ${ip}: ${error.message}`, 'ThermostatController', 'restartScanner');
        }
    }, interval);
    Logger.info(`Scanner restarted for ${ip}: ${interval / 1000} seconds interval`, 'ThermostatController', 'restartScanner');

    res.json({ message: `Scanner restarted for ${ip}.` });
};

const getDailyUsage = (req, res) => {
    const { ip } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = new Date(today).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const rows = db.prepare(`
        SELECT * FROM thermostat_readings
        WHERE ip = ? AND timestamp >= ? AND timestamp < ?
        ORDER BY timestamp DESC
    `).all(ip, startOfDay, endOfDay);

    // ...calculate run times, kWh, cost as in previous answers...
    res.json(rows);
};

const getThermostats = (req, res) => {
    const rows = db.prepare(`
        SELECT * FROM view_hvac_systems
    `).all();

    Logger.debug(`Received GET request: ${req.url}`, 'ThermostatController', 'getThermostats'); // Log the request body
    Logger.debug("Thermostat rows:", JSON.stringify(rows, null, 2), 'ThermostatController', 'getThermostats'); // Log the thermostat rows
    res.json(rows);
};

const addThermostat = (req, res) => {
    const { uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, enabled } = req.body;

    if (!uuid ||!ip || !model || !location || !cloudUrl || !cloudAuthkey || !scanInterval || !scanMode) {
        return res.status(400).json({ error: "Thermostat must have an uuid, IP, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, and enabled status." });
    }
    let enabled2 = enabled;
    if (enabled2 === undefined || enabled2 === null) {
        enabled2 = true;
    }
    const addThermostatStmt = db.prepare(`
        INSERT INTO thermostats (uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);
    addThermostatStmt.run(uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, enabled2);

    res.status(201).json({ message: "Thermostat added successfully" });
};

const updateThermostats = (req, res) => {
    const { uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, enabled } = req.body;

    if (!uuid ||!ip || !model || !location || !cloudUrl || !cloudAuthkey || !scanInterval || !scanMode) {
        return res.status(400).json({ error: "Thermostat must have an uuid, IP, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, and enabled status." });
    }
    let enabled2 = enabled;
    if (enabled2 === undefined || enabled2 === null) {
        enabled2 = true;
    }
    const updateThermostatStmt = db.prepare(`
        UPDATE thermostats SET uuid = ?, model = ?, location = ?, cloudUrl = ?, cloudAuthkey = ?, scanInterval = ?, scanMode = ?, enabled = ?
        WHERE ip = ?;
    `);
    updateThermostatStmt.run(uuid, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode, enabled2, ip);

    res.status(200).json({ message: "Thermostat updated successfully" });
};

const deleteThermostat = (req, res) => {
    const { ip } = req.params;

    if (!ip) {
        return res.status(400).json({ error: "IP address is required" });
    }
    const { thermostatInfo } = req.body;

    if (ip === undefined) {
        updateThermostatEnabled(thermostatInfo.ip, 0); // Disable the thermostat before deleting
    }
    else {
        updateThermostatEnabled(ip, 0); // Disable the thermostat before deleting
    }

    res.status(200).json({ message: "Thermostat disabled successfully" });
};

const scanThermostats = async (req, res) => {
    const { subnet } = req.params;
    const results = await scanSubnet(subnet, 3000);
    res.json(results);
};

const updateWeatherData = async () => {
    try {
        const weatherData = await weatherService.getWeatherData(process.env.WEATHER_LATITUDE, process.env.WEATHER_LONGITUDE);

        // Navigate to minutely intervals
        const intervals = weatherData.timelines?.minutely || [];

        if (intervals.length === 0) {
            Logger.info(`No minutely data found.`, 'thermostatController', 'updateWeatherData');
            Logger.debug(`Full weather data: ${JSON.stringify(weatherData, null, 2)}`, 'thermostatController', 'updateWeatherData', 2);
            return;
        }

        const entry = intervals[0]; // Only process the first item as that is the current value
                                    // other values are future predictions
        if (entry) {
            const time = new Date(entry.time).toLocaleString();
            const temperature = entry.values?.temperature ?? 'N/A';
            const cloudCover = entry.values?.cloudCover ?? 'N/A';
            const rainAccumulation = entry.values?.rainAccumulation ?? 'N/A';
            const rainIntensity = entry.values?.rainIntensity ?? 'N/A';
            const humidity = entry.values?.humidity ?? 'N/A';

            Logger.info(`Current Weather at ${time} => temp: ${temperature}, cloud cover: ${cloudCover}, rainAccumulation: ${rainAccumulation}, rainIntensity: ${rainIntensity}, humidity: ${humidity}`, 'thermostatController', 'updateWeatherData');
            Logger.debug(`Full weather entry data: ${JSON.stringify(entry, null, 2)}`, 'thermostatController', 'updateWeatherData', 2);

            if (temperature !== undefined && cloudCover !== undefined &&
                rainAccumulation !== undefined && rainIntensity !== undefined &&
                humidity !== undefined) {
                const ts = new Date(entry.time);
                const minuteKey = ts.toISOString().slice(0, 16); // e.g., "2025-09-17T15:42"

                // Update the matching time if found
                const stmt = db.prepare(`
                    UPDATE scan_data
                    SET outdoor_temp = ?, cloud_cover = ?, rainAccumulation = ?, rainIntensity = ?, outdoor_humidity = ?
                    WHERE (outdoor_temp IS NULL OR
                        cloud_cover IS NULL) AND
                        strftime('%Y-%m-%dT%H:%M', timestamp / 1000, 'unixepoch') = ?
                `);
                try {
                    const result = stmt.run(
                        temperature,
                        cloudCover,
                        rainAccumulation,
                        rainIntensity,
                        humidity,
                        minuteKey,
                    );
                    if (result.changes === 1) {
                        Logger.debug(`Current Weather data saved: ${minuteKey} => temp: ${temperature}, cloud cover: ${cloudCover}, rainAccumulation: ${rainAccumulation}, rainIntensity: ${rainIntensity}`, 'thermostatController', 'updateWeatherData', 1);
                    } else {
                        // Update the latest entry with the lastest values
                        const fallbackStmt = db.prepare(`
                            UPDATE scan_data
                            SET outdoor_temp = ?, cloud_cover = ?, rainAccumulation = ?, rainIntensity = ?, outdoor_humidity = ?
                            WHERE (outdoor_temp IS NULL OR cloud_cover IS NULL)
                            ORDER BY timestamp DESC
                            LIMIT 1
                        `);
                        fallbackStmt.run(temperature, cloudCover, rainAccumulation, rainIntensity, humidity);
                        Logger.debug(`Cached Weather data saved to latest row: => temp: ${temperature}, cloud cover: ${cloudCover}, rainAccumulation: ${rainAccumulation}, rainIntensity: ${rainIntensity}, humidity: ${humidity}`, 'thermostatController', 'updateWeatherData', 1);
                        return { temperature, cloudCover, rainAccumulation, rainIntensity, humidity};
                    }
                }
                catch (error) {
                    console.error(`Thermostat update failed for ${minuteKey}:`, error.message);
                    Logger.error(`Thermostat update failed for ${minuteKey}: ${error.message}`, 'thermostatController', 'updateWeatherData');
                }
            }
        }
    }
    catch (error) {
        console.log("Failed to update weather data.", error);
        Logger.error(`Failed to update weather data: ${error.message}`, 'thermostatController', 'updateWeatherData');
    }
    return null;
}

const segmentCycleByHour = async (cycle) => {
    const segments = [];
    const { thermostat_id, id: cycle_id, start_timestamp, stop_timestamp } = cycle;
    const end = stop_timestamp;
    let current = start_timestamp;

    while (current < end) {
        const hourStart = new Date(current);
        hourStart.setMinutes(0, 0, 0);
        const hourEnd = hourStart.getTime() + 3600000;

        const actual_end = Math.min(end, hourEnd);
        const duration_ms = actual_end - current;

        segments.push({
            thermostat_id,
            cycle_id,
            actual_start: current,
            actual_end,
            duration_ms,
            segment_hour: new Date(hourStart).toISOString().slice(0, 19).replace('T', ' ')
        });

        current = actual_end;
    }

    return segments;
};

const processCycleQueue = async () => {
    const now = Date.now();
    if (now - lastSegmentUpdate > SEGMENT_INTERVAL_MS) {
        lastSegmentUpdate = now;

        try {
            const unsegmentedCycles = db.prepare(`
                SELECT * FROM tstate_cycles
                WHERE stop_timestamp IS NOT NULL
                AND id NOT IN (SELECT cycle_id FROM cycle_segments)
            `).all();

            const insertSegmentStmt = db.prepare(`
                INSERT INTO cycle_segments (
                    thermostat_id,
                    cycle_id,
                    actual_start,
                    actual_end,
                    duration_ms,
                    segment_hour
                ) VALUES (?, ?, ?, ?, ?, ?)
            `);

            const insertSegments = db.transaction((segments) => {
                for (const seg of segments) {
                    insertSegmentStmt.run(
                        seg.thermostat_id,
                        seg.cycle_id,
                        seg.actual_start,
                        seg.actual_end,
                        seg.duration_ms,
                        seg.segment_hour
                    );
                }
            });

            for (const cycle of unsegmentedCycles) {
                const segments = await segmentCycleByHour(cycle);
                insertSegments(segments);
            }

            Logger.info(`Segmented ${unsegmentedCycles.length} completed cycles`, 'ThermostatController', 'captureStatIn');
        } catch (err) {
            Logger.error(`Error segmenting cycles: ${err.message}`, 'ThermostatController', 'captureStatIn');
        }
    }
};

const captureStatIn = async (req, res) => {
    const ip = (req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress).replace(/^::ffff:/, '');
    const currentTime = Date.now();
    const bodyB = req.body;

    Logger.info(`Received ${req.url}`, 'ThermostatController', 'captureStatIn'); // Log the request body
    if (process.env.DEBUG === "true") {
        Logger.debug(`Streamed Binary Data: ${bodyB}`, 'ThermostatController', 'captureStatIn', 1); // Print raw binary stream
    }

    const offsetB = bodyB.indexOf(Buffer.from("}"));

    if (offsetB === -1) {
        res.status(400).send('Need a JSON header');
        return;
    }

    const requestHdr = bodyB.slice(0, offsetB + 1);
    let jsonHdr;

    try {
        jsonHdr = JSON.parse(requestHdr.toString());
    } catch (err) {
        res.status(400).send('Need a valid JSON header');
        return;
    }

    if (!jsonHdr.uuid || !jsonHdr.eiv || jsonHdr.eiv.length !== 32) {
        res.status(400).send('Invalid JSON header');
        return;
    }

    let uuid, eiv;
    try {
        uuid = crypto.encode(jsonHdr.uuid);
        eiv = crypto.fromhex(jsonHdr.eiv);
    } catch (err) {
        res.status(400).send('Invalid hex values in JSON header');
        return;
    }

    if (uuid === undefined) {
            uuid = crypto.encode(process.env.TEST_THERMOSTAT_UUID || "5cdad4517dda");
    }

        const authkey = crypto.encode(process.env.THERMOSTAT_AUTH_KEY || "beaa4c96");

    if (process.env.DEBUG === "true") {
        Logger.debug(uuid.toString('hex'), 'ThermostatController', 'captureStatIn', 1); // Convert back to string if needed
        Logger.debug(authkey.toString('hex'), 'ThermostatController', 'captureStatIn', 1);
    }

    const aesKey = crypto.genAesKey(uuid, authkey);
    const hashKey = crypto.genHashKey(authkey);

    let requestPlaintext;
    let responsePlaintext;

    if (process.env.DEBUG === "true") {
        Logger.debug("Encryption data:", 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`UUID (Hex): ${uuid.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`AuthKey (Hex): ${authkey.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`AES Key (Hex): ${aesKey.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`Hash Key (Hex): ${hashKey.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`EIV Key (Hex): ${eiv.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
    }

    const encryptedData = bodyB.subarray(offsetB + 1);
    if (process.env.DEBUG === "true") {
        Logger.debug(`Length of Encrypted Data: ${encryptedData.length}`, 'ThermostatController', 'captureStatIn', 1);
        Logger.debug(`Encrypted Data (Hex): ${encryptedData.toString('hex')}`, 'ThermostatController', 'captureStatIn', 1);
    }
    requestPlaintext = crypto.decAuth(aesKey, hashKey, eiv, encryptedData);
    if (requestPlaintext === null || requestPlaintext === undefined) {
        res.status(400).send('Decryption failed');
        return;
    }
    Logger.info(`[thermostat to us] => ${crypto.parseJSON(requestPlaintext)}`, 'ThermostatController', 'captureStatIn');

    const jsonString = requestPlaintext.toString("utf-8"); // Convert to string
    const jsonData = JSON.parse(jsonString);  // Convert to JSON object

    if (jsonData.tstat) {
        let thermostat_id = undefined; //getIdByUUID(jsonHdr.uuid);
        let saveToDatabase = false;
        let location = "";
        if (!thermostat_id) {
            // Prepare the query to get the thermostat ID from the UUID
            const getThermostatIdStmt = db.prepare(`
                SELECT id, scanMode, location FROM thermostats WHERE uuid = ?;
            `);

            try {
                // Fetch thermostat_id from UUID
                const thermostatRow = getThermostatIdStmt.get(jsonHdr.uuid);
                if (!thermostatRow) {
                    console.error("Error: Thermostat not found for UUID:", jsonHdr.uuid);
                    Logger.error(`Thermostat not found for UUID: ${jsonHdr.uuid}`, 'ThermostatController', 'captureStatIn');
                    return;
                }
                thermostat_id = thermostatRow.id;
                location = thermostatRow.location;
                saveToDatabase = thermostatRow.scanMode === HVAC_MODE_COOL; // Check if scanMode is set to HVAC_MODE_COOL
                addDeviceByUUID(jsonHdr.uuid, thermostat_id);
            } catch (error) {
                console.error("Error: Thermostat not found for UUID:", jsonHdr.uuid);
                Logger.error(`Error: Thermostat not found for UUID: ${jsonHdr.uuid}. Error: ${error}`, 'ThermostatController', 'captureStatIn');
            }
        }
        if (process.env.DATABASE === "true" || saveToDatabase) {
            // Database insertion
            const stmt = db.prepare(`
                INSERT INTO scan_data (thermostat_id, timestamp, temp, tmode, tTemp, tstate, fstate)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            try {
                stmt.run(
                    thermostat_id,
                    currentTime,
                    jsonData.tstat.temp,
                    jsonData.tstat.tmode,
                    jsonData.tstat.tmode === HVAC_MODE_COOL ? jsonData.tstat.t_cool : jsonData.tstat.tmode === HVAC_MODE_HEAT ? jsonData.tstat.t_heat : null,
                    jsonData.tstat.tstate,
                    jsonData.tstat.fstate,
                );
                Logger.info(`Thermostat data saved: ${location}`, 'ThermostatController', 'captureStatIn');
                if (!cache[ip]) {
                    getScannerDataByIp(ip); // Initialize cache if not present
                }

                // Update cache
                cache[ip] = cache[ip] || { values: [] };
                const [ scanInterval, scanMode ] = getThermostatScanMode(ip);
                jsonData.tstat.scanMode = scanMode;
                jsonData.tstat.scanInterval = scanInterval;
                const updatedData = { timestamp: currentTime, ...jsonData.tstat }
                cache[ip].values.unshift(updatedData); // Add new value to the start
                cache[ip].lastUpdated = currentTime;
                cache[ip].source = 'cloud';

                // Limit cache size
                if (cache[ip].values.length > CACHE_LIMIT) {
                    cache[ip].values.pop(); // Remove oldest value
                }
                // Update weather data
                const weatherData = await updateWeatherData();
                cache[ip].outdoor_temp = weatherData ? weatherData.temperature : null;
                cache[ip].cloud_cover = weatherData ? weatherData.cloudCover : null;
                cache[ip].rainAccumulation = weatherData ? weatherData.rainAccumulation : null;
                cache[ip].rainIntensity = weatherData ? weatherData.rainIntensity : null;
                cache[ip].outdoor_humidity = weatherData ? weatherData.humidity : null;

                await processCycleQueue();
            } catch (error) {
                console.error(`Error saving Thermostat data for ${location}:`, error);
                Logger.error(`Error saving Thermostat data for ${location}: ${error}`, 'ThermostatController', 'captureStatIn');
            }
        }
    }

    if (process.env.FWD_URL) {
        const patchedRequestPlaintext = crypto.hookRequest(requestPlaintext);
        const newPayload = crypto.encAuth(aesKey, hashKey, eiv, patchedRequestPlaintext);
        const newRequest = JSON.stringify({ uuid: jsonHdr.uuid, eiv: jsonHdr.eiv, payload: newPayload });

        const parsedUrl = url.parse(process.env.FWD_URL);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.path,
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' }
        };

        const forwardReq = http.request(options, forwardRes => {
            let responseBody = [];
            forwardRes.on('data', chunk => responseBody.push(chunk));
            forwardRes.on('end', () => {
                try {
                    responsePlaintext = crypto.decAuth(aesKey, hashKey, eiv, Buffer.concat(responseBody));
                    responsePlaintext = crypto.hookResponse(responsePlaintext);
                } catch (err) {
                    res.status(400).send('Forward URL returned malformed response');
                    return;
                }

                Logger.info(`[us to thermostat] <= ${responsePlaintext.toString()}`, 'ThermostatController', 'captureStatIn');
                const responseEncrypted = crypto.encAuth(aesKey, hashKey, eiv, responsePlaintext);

                res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
            });
        });

        forwardReq.on('error', err => res.status(400).send('Forward request failed'));
        forwardReq.write(newRequest);
        forwardReq.end();
    } else {
        responsePlaintext = Buffer.from('{"ignore":0}');
        Logger.info(`[us to thermostat] <= ${responsePlaintext.toString()}`, 'ThermostatController', 'captureStatIn');

        const responseEncrypted = crypto.encAuth(aesKey, hashKey, eiv, responsePlaintext);
        res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
    }
};

const getDailyRuntime = (req, res) => {
    try {
        const { ip } = req.params;
        const { days } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (days && Number(days) > 0) ? `LIMIT ?` : ``;
        const query = `
            SELECT 
              date(start_timestamp / 1000, 'unixepoch', 'localtime') as run_date,
              SUM(run_time) AS total_runtime_hr
            FROM tstate_cycles
            WHERE thermostat_id = ?
            GROUP BY run_date
            ORDER BY run_date DESC
            ${limitClause};
        `;

        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, Number(days))
            : db.prepare(query).all(thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error in getDailyRuntime: ${error.message}`, 'ThermostatController', 'getDailyRuntime');
        res.status(500).json({ error: 'Failed to retrieve daily runtime data' });
    }
};

const getDailyModeRuntime = (req, res) => {
    try {
        const { ip } = req.params;
        const { days } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (days && Number(days) > 0) ? `LIMIT ?` : ``;
        const query =`
            SELECT 
              date(start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
              tmode,
              SUM(run_time) AS total_runtime_hr
            FROM tstate_cycles
            WHERE thermostat_id = ?
            GROUP BY run_date, tmode
            ORDER BY run_date DESC, tmode
            ${limitClause};
        `;

        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, Number(days))
            : db.prepare(query).all(thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error: ${error.message}`, 'ThermostatController', 'getDailyModeRuntime');
        res.status(500).json({ error: 'Failed to retrieve daily mode runtime data' });
    }
};

const getHourlyRuntime = (req, res) => {
    try {
        const { ip } = req.params;
        const { hours } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (hours && Number(hours) > 0) ? `LIMIT ?` : ``;
        const query = `
            SELECT segment_hour, total_runtime_minutes
            FROM view_cycle_hourly_runtime
            WHERE thermostat_id = ?
            ORDER BY segment_hour DESC
            ${limitClause};
        `;
    
        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, Number(hours))
            : db.prepare(query).all(thermostat.id);

        const now = new Date();
        const expectedHours = [];

        for (let i = Number(hours) - 1; i >= 0; i--) {
            const dt = new Date(now.getTime() - i * 3600000);
            dt.setMinutes(0, 0, 0); // Round to start of hour
            const formatted = dt.toISOString().slice(0, 19).replace('T', ' ');
            expectedHours.push(formatted);
        }

        const actualMap = new Map();
        rows.forEach(row => {
            actualMap.set(row.segment_hour, row.total_runtime_minutes);
        });

        const filledRows = expectedHours.map(hour => ({
            segment_hour: hour,
            total_runtime_minutes: actualMap.get(hour) || 0
        }));

        res.json(filledRows);
    } catch (error) {
        Logger.error(`Error: ${error.message}`, 'ThermostatController', 'getHourlyRuntime');
        res.status(500).json({ error: 'Failed to retrieve hourly environment data' });
    }
};

const getHourlyEnv = (req, res) => {
    try {
        const { ip } = req.params;
        const { hours } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (hours && Number(hours) > 0) ? `LIMIT ?` : ``;
        const query = `
            WITH hourly_env AS (
              SELECT 
                datetime(strftime('%Y-%m-%d %H:00', timestamp / 1000, 'unixepoch', 'localtime')) AS env_hour,
                AVG(outdoor_temp) AS avg_outdoor_temp,
                MIN(outdoor_temp) AS min_outdoor_temp,
                MAX(outdoor_temp) AS max_outdoor_temp,
                AVG(cloud_cover) AS avg_cloud_cover,
                AVG(rainIntensity) AS avg_rain_intensity,
                SUM(rainAccumulation) AS total_rain_accumulation,
                AVG(humidity) AS avg_humidity,
                AVG(outdoor_humidity) AS avg_outdoor_humidity,
                COUNT(*) AS sample_count
              FROM scan_data
              WHERE thermostat_id = ?
              GROUP BY env_hour
            )
            SELECT 
              datetime(strftime('%Y-%m-%d %H:00', c.start_timestamp / 1000, 'unixepoch', 'localtime')) AS run_hour,
              SUM(c.run_time) AS total_runtime_hr,
              e.avg_outdoor_temp,
              e.min_outdoor_temp,
              e.max_outdoor_temp,
              e.avg_cloud_cover,
              e.avg_rain_intensity,
              e.total_rain_accumulation,
              e.avg_humidity,
              e.avg_outdoor_humidity,
              e.sample_count
            FROM tstate_cycles c
            LEFT JOIN hourly_env e
              ON datetime(strftime('%Y-%m-%d %H:00', c.start_timestamp / 1000, 'unixepoch', 'localtime')) = e.env_hour
            WHERE c.thermostat_id = ?
            GROUP BY run_hour
            ORDER BY run_hour DESC
            ${limitClause};
        `;
    
        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, thermostat.id, Number(hours))
            : db.prepare(query).all(thermostat.id, thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error in getHourlyEnv: ${error.message}`, 'ThermostatController', 'getHourlyEnv');
        res.status(500).json({ error: 'Failed to retrieve hourly environment data' });
    }
};

const getFanVsHvacDaily = (req, res) => {
    try {
        const { ip } = req.params;
        const { days } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (days && Number(days) > 0) ? `LIMIT ?` : ``;
        const query = `
            SELECT 
              date(t.start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
              SUM(t.run_time) AS hvac_runtime_hr,
              SUM(f.run_time) AS fan_runtime_hr
            FROM tstate_cycles t
            JOIN fstate_cycles f
              ON date(t.start_timestamp / 1000, 'unixepoch', 'localtime') =
                 date(f.start_timestamp / 1000, 'unixepoch', 'localtime')
            WHERE t.thermostat_id = ? AND f.thermostat_id = ?
            GROUP BY run_date
            ORDER BY run_date DESC
            ${limitClause};
        `;
    
        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, thermostat.id, Number(days))
            : db.prepare(query).all(thermostat.id, thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error in getFanVsHvacDaily: ${error.message}`, 'ThermostatController', 'getFanVsHvacDaily');
        res.status(500).json({ error: 'Failed to retrieve fan vs hvac daily data' });
    }
};

const getTempVsRuntime = (req, res) => {
    try {
        const { ip } = req.params;
        const rows = db.prepare(`
            SELECT * FROM thermostat_runtime_vs_target WHERE day >= '2025-09-01' AND compressor_minutes < 721 AND ip = ?
        `).all(ip);
        res.json(rows);
    } catch (error) {
        Logger.error(`Error in getTempVsRuntime: ${error.message}`, 'ThermostatController', 'getTempVsRuntime');
        res.status(500).json({ error: 'Failed to retrieve temp vs runtime data' });
    }
};

const getDailyCycles = (req, res) => {
    try {
        const { ip } = req.params;
        const { days } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (days && Number(days) > 0) ? `LIMIT ?` : ``;
        const query = `
            SELECT
              date(start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
              COUNT(*) AS cycle_count,
              SUM(run_time) AS total_runtime_minutes
            FROM tstate_cycles
            WHERE thermostat_id = ?
            GROUP BY run_date
            ORDER BY run_date DESC
            ${limitClause};
        `;

        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, Number(days))
            : db.prepare(query).all(thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error in getDailyCycles: ${error.message}`, 'ThermostatController', 'getDailyCycles');
        res.status(500).json({ error: 'Failed to retrieve daily cycles data' });
    }
};

const getHourlyCycles = (req, res) => {
    try {
        const { ip } = req.params;
        const { hours } = req.query;
        const thermostat = db.prepare(`SELECT id FROM thermostats WHERE ip = ?`).get(ip);
        if (!thermostat) {
            return res.status(404).json({ error: "Thermostat not found" });
        }
        const limitClause = (hours && Number(hours) > 0) ? `LIMIT ?` : ``;
        const query = `
            SELECT
                date(start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
                strftime('%H', start_timestamp / 1000, 'unixepoch', 'localtime') AS hour,
                COUNT(*) AS cycle_count,
                SUM((stop_timestamp - start_timestamp) / 60000.0) AS total_runtime_minutes
            FROM tstate_cycles
            WHERE thermostat_id = ? AND stop_timestamp IS NOT NULL
            GROUP BY run_date, hour
            ORDER BY run_date DESC, hour DESC
            ${limitClause};
        `;

        const rows = (limitClause)
            ? db.prepare(query).all(thermostat.id, Number(hours))
            : db.prepare(query).all(thermostat.id);

        res.json(rows.reverse());
    } catch (error) {
        Logger.error(`Error in getDailyCycles: ${error.message}`, 'ThermostatController', 'getDailyCycles');
        res.status(500).json({ error: 'Failed to retrieve daily cycles data' });
    }
};

module.exports = {
    getThermostatData,
    updateThermostat,
    getCache,
    getModel,
    getName,
    getSwing,
    getThermostat,
    getThermostatDetailed,
    getSchedule,
    getCloud,
    updateName,
    rebootServer,
    updateSwing,
    updateSchedule,
    updateScheduleDay,
    updateCloud,
    startScanner,
    stopScanner,
    getScannerStatus,
    getScannerData,
    getScannerDetails,
    restartScanner,
    getDailyUsage,
    getThermostats,
    addThermostat,
    updateThermostats,
    deleteThermostat,
    scanThermostats,
    captureStatIn,
    getDailyRuntime,
    getHourlyRuntime,
    getDailyModeRuntime,
    getHourlyEnv,
    getFanVsHvacDaily,
    getTempVsRuntime,
    getDailyCycles,
    getHourlyCycles,
};