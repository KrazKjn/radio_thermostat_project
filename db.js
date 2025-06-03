const Database = require('better-sqlite3');
const db = new Database('thermostat_data.db');

// Create tables if they don't exist
db.exec(`
-- HVAC Thermostats
CREATE TABLE thermostats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,       -- Unique identifier (MAC/IP/Custom ID)
    ip TEXT UNIQUE,                  -- Optional: Store IP separately
    location TEXT,                   -- Physical location (e.g., Living Room)
    model TEXT,                      -- Thermostat model information
    scanInterval INTEGER DEFAULT 60, -- Scan interval in seconds
    cloudUrl TEXT,                   -- Optional: Cloud URL for remote access
    scanMode INTEGER DEFAULT 0 NOT NULL CHECK (scanMode IN (0, 1, 2)), -- Scan mode (0 = off, 1 = Scanned, 2 = Cloud)
    cloudAuthkey TEXT,               -- Cloud authentication key
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_thermostats_uuid ON thermostats(uuid);
`);

db.exec(`
-- HVAC Scan Data
CREATE TABLE scan_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,   -- Reference thermostats table
    timestamp INTEGER NOT NULL,        -- Unix timestamp (milliseconds)
    temp REAL,                        -- Current temperature
    tmode INTEGER,
    tTemp REAL,                       -- Target temperature
    tstate INTEGER,                    -- HVAC state
    fstate INTEGER,                    -- Fan state
    FOREIGN KEY (thermostat_id) REFERENCES thermostats(id)
);
CREATE INDEX idx_scan_data_thermostat ON scan_data(thermostat_id, timestamp);
`);

db.exec(`
CREATE VIEW thermostat_readings AS
SELECT sd.timestamp, t.uuid, t.ip, t.location, sd.temp, sd.tmode, sd.tTemp, sd.tstate, sd.fstate
FROM scan_data sd
JOIN thermostats t ON sd.thermostat_id = t.id;
`);

db.exec(`
-- HVAC Events
CREATE TABLE hvac_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,
    event_time INTEGER NOT NULL,  -- Unix timestamp (milliseconds)
    prev_tmode INTEGER,
    new_tmode INTEGER,
    prev_temp REAL,
    new_temp REAL,
    prev_tstate INTEGER,
    new_tstate INTEGER,
    prev_fstate INTEGER,
    new_fstate INTEGER,
    FOREIGN KEY (thermostat_id) REFERENCES thermostats(id)
);
`);

db.exec(`
CREATE TRIGGER track_hvac_changes
AFTER INSERT ON scan_data
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM scan_data 
    WHERE thermostat_id = NEW.thermostat_id 
    AND timestamp < NEW.timestamp
    AND (temp != NEW.temp OR tmode != NEW.tmode OR tstate != NEW.tstate OR fstate != NEW.fstate)
)
BEGIN
    INSERT INTO hvac_events (thermostat_id, event_time, prev_temp, new_temp, prev_tmode, new_tmode, prev_tstate, new_tstate, prev_fstate, new_fstate)
    SELECT NEW.thermostat_id, NEW.timestamp,
           (SELECT temp FROM scan_data WHERE thermostat_id = NEW.thermostat_id 
            ORDER BY timestamp DESC LIMIT 1 OFFSET 1),
           NEW.temp, 
           (SELECT tmode FROM scan_data WHERE thermostat_id = NEW.thermostat_id 
            ORDER BY timestamp DESC LIMIT 1 OFFSET 1),
           NEW.tmode,
           (SELECT tstate FROM scan_data WHERE thermostat_id = NEW.thermostat_id 
            ORDER BY timestamp DESC LIMIT 1 OFFSET 1),
           NEW.tstate,
           (SELECT fstate FROM scan_data WHERE thermostat_id = NEW.thermostat_id 
            ORDER BY timestamp DESC LIMIT 1 OFFSET 1),
           NEW.fstate
    WHERE (SELECT temp FROM scan_data WHERE thermostat_id = NEW.thermostat_id ORDER BY timestamp DESC LIMIT 1 OFFSET 1) != NEW.temp
        OR (SELECT tstate FROM scan_data WHERE thermostat_id = NEW.thermostat_id ORDER BY timestamp DESC LIMIT 1 OFFSET 1) != NEW.tstate
        OR (SELECT fstate FROM scan_data WHERE thermostat_id = NEW.thermostat_id ORDER BY timestamp DESC LIMIT 1 OFFSET 1) != NEW.fstate;
END;
`);

db.exec(`
CREATE VIEW hvac_summary AS
SELECT h.event_time, t.uuid, t.ip, t.location,
       h.prev_temp, h.new_temp,
       h.prev_tmode, h.new_tmode,
       h.prev_tstate, h.new_tstate,
       h.prev_fstate, h.new_fstate
FROM hvac_events h
JOIN thermostats t ON h.thermostat_id = t.id;
`);

module.exports = db;