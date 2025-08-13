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

-- Create users table
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Example insert statements (passwords should be hashed in your application code)
--INSERT INTO users (id, username, email, password, role) VALUES
--('1', 'admin', 'admin@example.com', '<hashed_password>', 'admin'),
--('2', 'user1', 'user1@example.com', '<hashed_password>', 'user'),
--('3', 'user2', 'user2@example.com', '<hashed_password>', 'user');

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

CREATE VIEW thermostat_readings AS
SELECT sd.timestamp, t.uuid, t.ip, t.location, sd.temp, sd.tmode, sd.tTemp, sd.tstate, sd.fstate
FROM scan_data sd
JOIN thermostats t ON sd.thermostat_id = t.id;

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

CREATE VIEW hvac_summary AS
SELECT h.event_time, t.uuid, t.ip, t.location,
       h.prev_temp, h.new_temp,
       h.prev_tmode, h.new_tmode,
       h.prev_tstate, h.new_tstate,
       h.prev_fstate, h.new_fstate
FROM hvac_events h
JOIN thermostats t ON h.thermostat_id = t.id;
