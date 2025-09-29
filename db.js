const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const dbPath = path.resolve(__dirname, './thermostat_data.db'); // Adjust relative path as needed
const Logger = require('./components/Logger');

// Check if the file exists
if (!fs.existsSync(dbPath)) {
    //throw new Error(`Database file not found at path: ${dbPath}`);
    Logger.info(`Creating new Database at path: ${dbPath}`, 'DB', 'init');
}
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
-- HVAC Thermostats
CREATE TABLE IF NOT EXISTS thermostats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,       -- Unique identifier (MAC/IP/Custom ID)
    ip TEXT UNIQUE,                  -- Optional: Store IP separately
    location TEXT,                   -- Physical location (e.g., Living Room)
    model TEXT,                      -- Thermostat model information
    scanInterval INTEGER DEFAULT 60, -- Scan interval in seconds
    cloudUrl TEXT,                   -- Optional: Cloud URL for remote access
    scanMode INTEGER DEFAULT 0 NOT NULL CHECK (scanMode IN (0, 1, 2)), -- Scan mode (0 = off, 1 = Scanned, 2 = Cloud)
    cloudAuthkey TEXT,               -- Cloud authentication key
    enabled BOOLEAN DEFAULT 1,       -- New field to enable/disable thermostat
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_thermostats_uuid ON thermostats(uuid);
`);

db.exec(`
-- Create the roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

-- Create the role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roleId INTEGER NOT NULL,
    permission TEXT NOT NULL,
    FOREIGN KEY (roleId) REFERENCES roles(id)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(roleId);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission);
-- Insert default roles
INSERT OR IGNORE INTO roles (name) VALUES ('admin'), ('user'), ('guest');
-- Insert default permissions
INSERT OR IGNORE INTO role_permissions (roleId, permission) VALUES
(1, 'read'), (1, 'write'), (1, 'delete'),
(2, 'read'), (2, 'write'),
(3, 'read');
-- Create indexes for roles and permissions
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_permission ON role_permissions(roleId, permission);
`);

db.exec(`
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    roleId INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT 1, -- New field to enable/disable user
    FOREIGN KEY (roleId) REFERENCES roles(id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
`);

db.exec(`
CREATE VIEW IF NOT EXISTS user_authorization AS
SELECT users.id, users.username, users.email, users.password, roles.name AS role
FROM users
JOIN roles ON users.roleId = roles.id;
`);

db.exec(`
-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    sessionToken TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
);
`);

db.exec(`
-- HVAC Scan Data
CREATE TABLE IF NOT EXISTS scan_data (
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
CREATE INDEX IF NOT EXISTS idx_scan_data_thermostat ON scan_data(thermostat_id, timestamp);
`);

db.exec(`
CREATE VIEW IF NOT EXISTS thermostat_readings AS
SELECT sd.timestamp, t.uuid, t.ip, t.location, sd.temp, sd.tmode, sd.tTemp, sd.tstate, sd.fstate
FROM scan_data sd
JOIN thermostats t ON sd.thermostat_id = t.id;
`);

db.exec(`
-- HVAC Events
CREATE TABLE IF NOT EXISTS hvac_events (
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
CREATE TRIGGER IF NOT EXISTS track_hvac_changes
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
CREATE VIEW IF NOT EXISTS hvac_summary AS
SELECT h.event_time, t.uuid, t.ip, t.location,
       h.prev_temp, h.new_temp,
       h.prev_tmode, h.new_tmode,
       h.prev_tstate, h.new_tstate,
       h.prev_fstate, h.new_fstate
FROM hvac_events h
JOIN thermostats t ON h.thermostat_id = t.id;
`);

// Check if column exists
let columns = db.prepare("PRAGMA table_info(thermostats)").all();
let hasNewField = columns.some(col => col.name === 'enabled');

if (!hasNewField) {
  db.prepare("ALTER TABLE thermostats ADD COLUMN enabled BOOLEAN DEFAULT 1").run();
}

columns = db.prepare("PRAGMA table_info(users)").all();
hasNewField = columns.some(col => col.name === 'enabled');

if (!hasNewField) {
  db.prepare("ALTER TABLE users ADD COLUMN enabled BOOLEAN DEFAULT 1").run();
}

module.exports = db;