const fetch = require("node-fetch");
const db = require('../../db');
const { getThermostatScanMode, updateThermostatScanMode2, updateThermostatEnabled, scannerIntervalTask, scanSubnet, addDeviceByUUID } = require('../services/thermostatService');
const { convertToTwoDecimalFloat, formatTimestamp } = require('../utils/utils');
const { HVAC_MODE_COOL, HVAC_MODE_HEAT } = require('../../constants/hvac_mode');
const { HVAC_SCAN_CLOUD } = require('../../constants/hvac_scan');
const crypto = require('../utils/crypto');

const cache = {};
const CACHE_LIMIT = 120; // Limit cache size to 120 entries
const CACHE_EXPIRATION = 15000; // 15 seconds
const DEFAULT_SCAN_INTERVAL = 60000; // Scan every 15 seconds
const scanners = {}; // Store active scanners by IP
const daysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const getThermostatData = async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const currentTime = Date.now();
        const noCache = req.query.noCache === "true"; // Check for cache override

        // Use cached data if it's recent and cache override is NOT requested
        if (!noCache && cache[ip] && currentTime - cache[ip].lastUpdated < CACHE_EXPIRATION) {
            console.log("Returning cached data");
            return res.json(cache[ip].values[0]); // Return the most recent cached value
        }

        // Fetch new data
        const response = await fetch(`http://${ip}/tstat`);
        const data = await response.json();

        // Update cache
        cache[ip] = cache[ip] || { values: [] };
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

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat data" });
    }
};

const updateThermostat = async (req, res) => {
    console.log(`${Date().toString()}: Received POST request: ${req.url}`); // Log the request body
    console.log("Request Body:", JSON.stringify(req.body, null, 2)); // Logs JSON with formatting
    const { tmode, temperature, time, fmode, hold, override } = req.body; // Get values from request
    const { ip } = req.params; // Get ip from request parameters
    // Validate request body
    if (!ip) {
        console.log("IP address is missing in the request parameters.");
        return res.status(400).json({ error: "Missing target ip address" });
    }
    if (!time) {
        if (tmode === undefined && fmode === undefined && hold === undefined && override === undefined) {
            console.log("time, tmode, fmode, hold, and override are all missing in the request body. One is required.");
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
    console.log("POST body:", JSON.stringify(payload)); // Log the post body

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

        res.json(data);
    } catch (error) {
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
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/model`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat model/version data" });
    }
};

const getName = async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/sys/name`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat name data" });
    }
};

const getSwing = async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/tswing`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat swing data" });
    }
};

const getThermostat = async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const { ip } = req.params;
        const endpoints = {
            model: `http://${ip}/tstat/model`,
            name: `http://${ip}/sys/name`,
        };
        let combinedData = {};
        console.log(`${Date().toString()}: Invoking: ${ JSON.stringify(endpoints)}`);
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
        res.status(500).json({ error: "Failed to retrieve thermostat data", details: error.message });
    }
};

const getThermostatDetailed = async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const { ip } = req.params;
        const endpoints = {
            model: `http://${ip}/tstat/model`,
            name: `http://${ip}/sys/name`,
            sys: `http://${ip}/sys`,
            cloud: `http://${ip}/cloud`,
        };
        let combinedData = {};
        console.log(`${Date().toString()}: Invoking: ${ JSON.stringify(endpoints) }`);
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
        res.status(500).json({ error: "Failed to retrieve thermostat data", details: error.message });
    }
};

const getSchedule = async (req, res) => {
    try {
        console.log(`${new Date().toString()}: Received GET request: ${req.url}`);

        const ip = req.params.ip;
        let scheduleMode = req.params.scheduleMode.toLowerCase(); // Ensure case insensitivity

        // Validate scheduleMode
        if (!["cool", "heat"].includes(scheduleMode)) {
            console.log("Invalid schedule mode. Use 'cool' or 'heat'.");
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        console.log(`${new Date().toString()}: Invoking: http://${ip}/tstat/program/${scheduleMode}`);

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}`);
        if (!response.ok) throw new Error("Failed to fetch data from thermostat");

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to retrieve thermostat schedule data" });
    }
};

const getCloud = async (req, res) => {
    try {
        console.log(`${new Date().toString()}: Received GET request: ${req.url}`);

        const ip = req.params.ip;
        console.log(`${new Date().toString()}: Invoking: http://${ip}/cloud`);

        const response = await fetch(`http://${ip}/cloud`);
        if (!response.ok) throw new Error("Failed to fetch data from thermostat");

        const data = await response.json();

        const [ scanInterval, scanMode ] = getThermostatScanMode(ip);
        data.scanMode = scanMode;
        data.scanInterval = scanInterval;

        res.json(data);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to retrieve thermostat cloud data" });
    }
};

const updateName = async (req, res) => {
    console.log(`${Date().toString()}: Received POST request: ${req.url}`); // Log the request body
    const { name } = req.body; // Get values from request
    const { ip } = req.params;
    // Validate request body
    if (!name) {
        return res.status(400).json({ error: "Missing new name" });
    }
    const payload = {
      name: name
    };
    console.log("POST body:", JSON.stringify(payload)); // Log the post body
  
    try {
        const response = await fetch(`http://${ip}/sys/name`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
  
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to update thermostat name" });
    }
};

const updateSwing = async (req, res) => {
    console.log(`${Date().toString()}: Received POST request: ${req.url}`); // Log the request body
    const { tswing } = req.body; // Get values from request
    const { ip } = req.params;
    // Validate request body
    if (!tswing) {
        return res.status(400).json({ error: "Missing new tswing value" });
    }
    const payload = {
        tswing: convertToTwoDecimalFloat(tswing)
    };
    console.log("POST body:", JSON.stringify(payload)); // Log the post body
  
    try {
        const response = await fetch(`http://${ip}/tstat/tswing`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
  
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to update thermostat tswing" });
    }
};

const updateSchedule = async (req, res) => {
    try {
        console.log(`${new Date().toString()}: Received POST request: ${req.url}`);

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
            console.log("Invalid schedule mode. Use 'cool' or 'heat'.");
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        console.log(`${new Date().toString()}: Invoking: http://${ip}/tstat/program/${scheduleMode}`);

        // Validate request body
        if (!data) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            console.log("POST body:", data); // Log the post body
        } catch {}

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        });
    
        const respData = await response.json();
        console.log("POST response:", JSON.stringify(respData)); // Log the post response
        res.json(respData);
    } catch (error) {
        console.log("Error: ", error);
        console.error("Error: ", error);
        res.status(500).json({ error: "Failed to update thermostat schedule data" });
    }
};

const updateScheduleDay = async (req, res) => {
    try {
        console.log(`${new Date().toString()}: Received POST request: ${req.url}`);

        const ip = req.params.ip;
        let scheduleMode = req.params.scheduleMode.toLowerCase(); // Ensure case insensitivity
        const day = Number(req.params.day);
        const data = `{ "${day}": ${JSON.stringify(req.body)} }`; // Get values from request

        // Validate scheduleMode
        if (!["cool", "heat"].includes(scheduleMode)) {
            console.log("Invalid schedule mode. Use 'cool' or 'heat'.");
            return res.status(400).json({ error: "Invalid schedule mode. Use 'cool' or 'heat'." });
        }

        console.log(`${new Date().toString()}: Invoking: http://${ip}/tstat/program/${scheduleMode}/${day}`);

        // Validate request body
        if (!data) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            console.log("POST body:", data); // Log the post body
        } catch {}

        const response = await fetch(`http://${ip}/tstat/program/${scheduleMode}/${daysOfWeek[day]}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data
        });
    
        const respData = await response.json();
        console.log("POST response:", JSON.stringify(respData)); // Log the post response
        res.json(respData);
    } catch (error) {
        console.log("Error: ", error);
        console.error("Error: ", error);
        res.status(500).json({ error: "Failed to update thermostat schedule data" });
    }
};

const updateCloud = async (req, res) => {
    try {
        console.log(`${new Date().toString()}: Received POST request: ${req.url}`);

        const ip = req.params.ip;

        console.log(`${new Date().toString()}: Invoking: http://${ip}/cloud`);

        // Validate request body
        if (!req.body) {
            return res.status(400).json({ error: "Missing new data value" });
        }
        try {
            console.log("POST body:", data); // Log the post body
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
        console.log("POST response:", respData);
        res.json(respData);
    } catch (error) {
        console.log("Error: ", error);
        console.error("Error: ", error);
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
        }
    }, interval);
    console.log(`Scanner started for ${ip}: ${interval / 1000} seconds interval`);

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

const getScannerData = (req, res) => {
    const { ip } = req.params;

    if (!cache[ip]) {
        return res.status(404).json({ error: `No scanned data found for IP ${ip}.` });
    }
    if (!cache[ip] || cache[ip].values.length < CACHE_LIMIT) {
        const totalRows = db.prepare(`
            SELECT COUNT(*) as count FROM thermostat_readings WHERE ip = ?;
        `).get(ip).count;

        const rows = db.prepare(`
            SELECT * FROM thermostat_readings
            WHERE ip = ? 
            ORDER BY timestamp DESC
            LIMIT ${CACHE_LIMIT} OFFSET ${Math.min(cache[ip].values.length, totalRows)}
        `).all(ip);

        // ...calculate run times, kWh, cost as in previous answers...
        cache[ip].values = rows.map(row => {
            let entry = {
                timestamp: row.timestamp,
                temp: row.temp,
                tmode: row.tmode,
                fmode: 0,
                override: 0,
                hold:  0,
                tstate: row.tstate,
                fstate: row.fstate,
                t_type_post: 0,
                time: formatTimestamp(row.timestamp)
            };

            // Add t_cool only if tmode is HVAC_MODE_COOL
            if (row.tmode === HVAC_MODE_COOL) {
                entry.t_cool = row.tTemp;
            }

            // Add t_heat only if tmode is HVAC_MODE_HEAT
            if (row.tmode === HVAC_MODE_HEAT) {
                entry.t_heat = row.tTemp;
            }

            return entry;
        });
    }
    res.json(cache[ip].values);
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
        }
    }, interval);
    console.log(`Scanner restarted for ${ip}: ${interval / 1000} seconds interval`);

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
        SELECT * FROM thermostats
    `).all();

    console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
    console.log("Thermostat rows:", JSON.stringify(rows, null, 2)); // Log the thermostat rows
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

const captureStatIn = (req, res) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const currentTime = Date.now();
    const bodyB = req.body;

    console.log(`${crypto.formatUnixTime(currentTime)}: Received POST request: ${req.url}`); // Log the request body
    if (process.env.DEBUG === "true") {
        console.log("Streamed Binary Data:", bodyB); // Print raw binary stream
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
        console.log(uuid.toString('hex')); // Convert back to string if needed
        console.log(authkey.toString('hex'));
    }

    const aesKey = crypto.genAesKey(uuid, authkey);
    const hashKey = crypto.genHashKey(authkey);

    let requestPlaintext;
    let responsePlaintext;

    if (process.env.DEBUG === "true") {
        console.log("Encryption data:");
        console.log("UUID (Hex): ", uuid.toString('hex'))
        console.log("AuthKey (Hex): ", authkey.toString('hex'))
        console.log("AES Key (Hex): ", aesKey.toString('hex'));
        console.log("Hash Key (Hex): ", hashKey.toString('hex'));
        console.log("EIV Key (Hex): ", eiv.toString('hex'));
    }

    const encryptedData = bodyB.subarray(offsetB + 1);
    if (process.env.DEBUG === "true") {
        console.log("Length of Encrypted Data: ", encryptedData.length);
        console.log("Encrypted Data (Hex): ", encryptedData.toString('hex'));
    }
    requestPlaintext = crypto.decAuth(aesKey, hashKey, eiv, encryptedData);
    if (requestPlaintext === null || requestPlaintext === undefined) {
        res.status(400).send('Decryption failed');
        return;
    }
    console.log("[thermostat to us] =>", crypto.parseJSON(requestPlaintext));

    const jsonString = requestPlaintext.toString("utf-8"); // Convert to string
    const jsonData = JSON.parse(jsonString);  // Convert to JSON object
    //console.log(jsonData);

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
                    return;
                }
                thermostat_id = thermostatRow.id;
                location = thermostatRow.location;
                saveToDatabase = thermostatRow.scanMode === HVAC_MODE_COOL; // Check if scanMode is set to HVAC_MODE_COOL
                addDeviceByUUID(jsonHdr.uuid, thermostat_id);
            } catch (error) {
                console.error("Error: Thermostat not found for UUID:", jsonHdr.uuid);
                console.log(`Error: Thermostat not found for UUID: ${jsonHdr.uuid}. Error: ${error}`);
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
                console.log("Thermostat data saved: ", location);
            } catch (error) {
                console.log(`Error saving Thermostat data for: ${location}. Error: ${error}`);
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

                console.log("[us to thermostat] <=", responsePlaintext.toString());
                const responseEncrypted = crypto.encAuth(aesKey, hashKey, eiv, responsePlaintext);

                res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
            });
        });

        forwardReq.on('error', err => res.status(400).send('Forward request failed'));
        forwardReq.write(newRequest);
        forwardReq.end();
    } else {
        responsePlaintext = Buffer.from('{"ignore":0}');
        console.log("[us to thermostat] <=", responsePlaintext.toString());

        const responseEncrypted = crypto.encAuth(aesKey, hashKey, eiv, responsePlaintext);
        res.status(200).header('Content-Type', 'application/octet-stream').send(responseEncrypted);
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
};
