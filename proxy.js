const { HVAC_MODE_OFF, HVAC_MODE_HEAT, HVAC_MODE_COOL, HVAC_MODE_AUTO } = require('./constants/hvac_mode.js');
const { HVAC_SCAN_DISABLED, HVAC_SCAN_DEMAND, HVAC_SCAN_CLOUD } = require('./constants/hvac_scan.js');
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require('./db'); // Import your db module
const { exec } = require("child_process");
const axios = require("axios");
const snmp = require("net-snmp");
//require("dotenv").config(); // If using dotenv for env vars
const app = express();
const SECRET_KEY = "your_secret_key"; // Use a strong key in production

const optionsSNMP = {
    timeout: 1000, // Timeout in milliseconds (1 second)
    retries: 2,    // Number of retry attempts
};

app.use(cors());
app.use(bodyParser.json()); // Enable JSON parsing

// Cache object to store thermostat data by IP
const cache = {};
const CACHE_LIMIT = 120; // Limit cache size to 120 entries
const CACHE_EXPIRATION = 15000; // 15 seconds
const DEFAULT_SCAN_INTERVAL = 60000; // Scan every 15 seconds
const scanners = {}; // Store active scanners by IP
const daysOfWeek = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SERVICE_TOKEN_PAYLOAD = { username: "service", role: "service" };
const SERVICE_TOKEN_EXPIRY = "30d"; // or as needed

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

// Function to generate a new service token
function generateServiceToken() {
    return jwt.sign(SERVICE_TOKEN_PAYLOAD, SECRET_KEY, { expiresIn: SERVICE_TOKEN_EXPIRY });
}

// Store the current service token and its expiration
let SERVICE_TOKEN = generateServiceToken();
let SERVICE_TOKEN_EXP = jwt.decode(SERVICE_TOKEN).exp * 1000; // ms

// Helper to check and refresh the service token if expired or about to expire
function getValidServiceToken() {
    const now = Date.now();
    // Refresh if token expires in less than 1 minute
    if (!SERVICE_TOKEN || !SERVICE_TOKEN_EXP || SERVICE_TOKEN_EXP - now < 60000) {
        SERVICE_TOKEN = generateServiceToken();
        SERVICE_TOKEN_EXP = jwt.decode(SERVICE_TOKEN).exp * 1000;
        console.log("Service token refreshed at", new Date().toISOString());
    }
    return SERVICE_TOKEN;
}

function convertToTwoDecimalFloat(text) {
  const num = parseFloat(text);
  return isNaN(num) ? null : parseFloat(num.toFixed(2));
}

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Forbidden: Invalid token" });

        req.user = user;
        next();
    });
};

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);

    return {
        day: date.getDate(),
        hour: date.getHours(),
        minute: date.getMinutes()
    };
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
        exec(`arp -a ${ip}`, (error, stdout) => {
            if (error) return resolve(null);
            const match = stdout.match(/(([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})/);
            resolve(match ? match[0] : null);
        });
    });
}

// Get Device Name via SNMP
async function getDeviceName(ip) {
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

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (row.count === 0) {
    // No users exist, create the first admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)
    `);
    console.log(`Creating first admin user. username: ${username}, email: ${username}@test.net, password: ${hashedPassword}, role: admin`);
    stmt.run(
        username,
        `${username}@test.net`,
        hashedPassword,
        'admin'
    );        
  }
  const getUserStmt = db.prepare(`
    SELECT * FROM users WHERE username = ?;
  `);

  const user = getUserStmt.get(username);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  //const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: "1h" });
  res.json({ token });
});

// Update the scanMode for a thermostat by ip using SQLite and db context
const updateThermostatScanMode = (ip, scanMode) => {
  return new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          "UPDATE thermostats SET scanMode = ? WHERE ip = ?",
          [scanMode, ip],
          (_, result) => {
            if (result.rowsAffected === 0) {
              reject(new Error("No rows updated. IP may not exist."));
            } else {
              resolve(result);
            }
          },
          (_, error) => {
            console.error("SQL error:", error);
            reject(error);
            return false; // stops further error propagation
          }
        );
      },
      error => {
        console.error("Transaction error:", error);
        reject(error);
      }
    );
  });
};

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

            const response = await fetch(`http://localhost:5000/tstat/${ip}`, {
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

const authRoutes = express.Router();

authRoutes.use(authenticateToken);

authRoutes.get("/user", async (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

authRoutes.get("/tstat/:ip", async (req, res) => {
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
});

authRoutes.post("/tstat/:ip", async (req, res) => {
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
        const response2 = await fetch(`http://localhost:5000/tstat/${ip}?noCache=true`, {
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
}); 

// Get all cached data for an IP
authRoutes.get("/cache/:ip", (req, res) => {
    const ip = req.params.ip;
    if (!cache[ip]) {
        return res.status(404).json({ error: "No cached data found for this IP" });
    }
    res.json(cache[ip].values);
});

authRoutes.get("/model/:ip", async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/model`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat model/version data" });
    }
});

authRoutes.get("/name/:ip", async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/sys/name`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat name data" });
    }
});

authRoutes.get("/tswing/:ip", async (req, res) => {
    try {
        console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
        const ip = req.params.ip;
        const response = await fetch(`http://${ip}/tstat/tswing`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to retrieve thermostat swing data" });
    }
});

authRoutes.get("/thermostat/:ip", async (req, res) => {
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
});

authRoutes.get("/thermostat/detailed/:ip", async (req, res) => {
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
});

authRoutes.get("/schedule/:scheduleMode/:ip", async (req, res) => {
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
});

authRoutes.get("/cloud/:ip", async (req, res) => {
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
});

// **Proxy POST request (for updating thermostat name)**
authRoutes.post("/thermostat/name/:ip", async (req, res) => {
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
});

// **Proxy POST request (for updating thermostat name)**
authRoutes.post("/tswing/:ip", async (req, res) => {
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
}); 

authRoutes.post("/schedule/:scheduleMode/:ip", async (req, res) => {
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
});

authRoutes.post("/schedule/:scheduleMode/:day/:ip", async (req, res) => {
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
});

authRoutes.post("/cloud/:ip", async (req, res) => {
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
            // updateThermostatScanMode(ip, req.body.scanMode)
            //     .then(() => {
            //         // Successfully updated scanMode in the database
            //         console.log(`Updated scanMode for IP ${ip} to ${req.body.scanMode}`);
            //     })
            //     .catch((error) => {
            //         console.error(`Failed to update scanMode for IP ${ip}:`, error);
            //     });
        }
        const payload = {
            interval: req.body.interval || 60, // Default to 60 seconds if not provided
            url: req.body.url || "",
            enabled: req.body.enabled || 0, // Default to 0 if not provided
            authkey: req.body.authkey || "", // Default to empty string if not provided
            status: req.body.status || 2,
            status_code: req.body.status_code || 200
        };

        const response = await fetch(`http://${ip}/cloud`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    
        const respData = await response.json();
        console.log("POST response:", JSON.stringify(respData)); // Log the post response
        res.json(respData);
    } catch (error) {
        console.log("Error: ", error);
        console.error("Error: ", error);
        res.status(500).json({ error: "Failed to update thermostat cloud data" });
    }
});

// Start scanner
authRoutes.post("/scanner/start/:ip", (req, res) => {
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
});

// Stop scanner
authRoutes.post("/scanner/stop/:ip", (req, res) => {
    const { ip } = req.params;

    if (!scanners[ip]) {
        return res.status(400).json({ error: `No scanner is running for ${ip}.` });
    }

    clearInterval(scanners[ip]);
    delete scanners[ip];

    res.json({ message: `Scanner stopped for ${ip}.` });
});

// Get running scanners
authRoutes.get("/scanner/status", (req, res) => {
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
});

// Get scanned data for a specific IP
authRoutes.get("/scanner/data/:ip", (req, res) => {
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
});

// Get detailed status of all active scanners
authRoutes.get("/scanner/details", (req, res) => {
    const scannerDetails = Object.keys(scanners).map((ip) => ({
        ip,
        interval: scanners[ip]._idleTimeout,
    }));

    res.json({ activeScanners: scannerDetails });
});

// Restart scanner
authRoutes.post("/scanner/restart/:ip", (req, res) => {
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
});

// Example: Get daily usage for an IP
authRoutes.get("/usage/daily/:ip", (req, res) => {
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
});

authRoutes.get("/thermostats", (req, res) => {
    const rows = db.prepare(`
        SELECT * FROM thermostats
    `).all();

    console.log(`${Date().toString()}: Received GET request: ${req.url}`); // Log the request body
    console.log("Thermostat rows:", JSON.stringify(rows, null, 2)); // Log the thermostat rows
    res.json(rows);
    // if (rows.length) {
    //     return JSON.stringify(rows, null, 2); // Converts rows into JSON format
    // } else {
    //     return JSON.stringify([]); // Returns empty JSON array if no data
    // }    
    //res.json({ data: rows });

    // const getThermostatIdStmt = db.prepare(`
    //     SELECT * FROM thermostats;
    // `);

    // const thermostatRows = getThermostatIdStmt.all(); // Use `.all()` to get multiple rows

    // if (thermostatRows.length) {
    //     return JSON.stringify(thermostatRows, null, 2); // Converts rows into JSON format
    // } else {
    //     return JSON.stringify([]); // Returns empty JSON array if no data
    // }    
});

authRoutes.get("/thermostatscan/:subnet", async (req, res) => {
    const { subnet } = req.params;
    const results = await scanSubnet(subnet, 3000);
    res.json(results);
});

authRoutes.post("/thermostats", (req, res) => {
    const { uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode } = req.body;
    if (!uuid ||!ip || !model || !location || !cloudUrl || !cloudAuthkey || !scanInterval || !scanMode) {
        return res.status(400).json({ error: "Thermostat must have an uuid, IP, model, location, cloudUrl, cloudAuthkey, scanInterval, and scanMode." });
    }

    const addThermostatStmt = db.prepare(`
        INSERT INTO thermostats (uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `);
    addThermostatStmt.run(uuid, ip, model, location, cloudUrl, cloudAuthkey, scanInterval, scanMode);

    res.status(201).json({ message: "Thermostat added successfully" });
});

app.use(authRoutes);
app.listen(5000, () => console.log("Proxy running at http://localhost:5000"));