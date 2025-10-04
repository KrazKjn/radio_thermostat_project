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
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX idx_thermostats_uuid ON thermostats(uuid);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS scan_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,    -- Reference thermostats table
    timestamp INTEGER NOT NULL,        -- Unix timestamp (milliseconds)
    temp REAL,                         -- Current temperature
    tmode INTEGER,
    tTemp REAL,                        -- Target temperature
    tstate INTEGER,                    -- HVAC state
    fstate INTEGER,                    -- Fan state
    outdoor_temp REAL,                 -- Outdoor temperature
    cloud_cover REAL,                  -- Percentage Cloud Cover
    rainAccumulation REALm             -- total rainfall over a period
    rainIntensity REAL,                -- rate of rainfall
    FOREIGN KEY (thermostat_id) REFERENCES thermostats(id)
);

CREATE INDEX idx_scan_data_thermostat ON scan_data(thermostat_id, timestamp);

DROP VIEW IF EXISTS thermostat_readings;
CREATE VIEW thermostat_readings AS
SELECT sd.timestamp,
    t.uuid, t.ip, t.location,
    sd.temp, sd.tmode, sd.tTemp,
    sd.tstate, sd.fstate, sd.outdoor_temp,
    sd.cloud_cover, sd.rainAccumulation, sd.rainIntensity
FROM scan_data sd
JOIN thermostats t ON sd.thermostat_id = t.id

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

-- Thermostat State Cycles
CREATE TABLE IF NOT EXISTS tstate_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,
    tmode INTEGER,
    start_timestamp INTEGER,
    stop_timestamp INTEGER,
    start_time TEXT,
    stop_time TEXT,
    run_time REAL
)

-- Fan State Cycles
CREATE TABLE IF NOT EXISTS fstate_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,
    tmode INTEGER,
    start_timestamp INTEGER,
    stop_timestamp INTEGER,
    start_time TEXT,
    stop_time TEXT,
    run_time REAL
)

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

DROP VIEW IF EXISTS hvac_summary;
CREATE VIEW hvac_summary AS
SELECT h.event_time, t.uuid, t.ip, t.location,
       h.prev_temp, h.new_temp,
       h.prev_tmode, h.new_tmode,
       h.prev_tstate, h.new_tstate,
       h.prev_fstate, h.new_fstate
FROM hvac_events h
JOIN thermostats t ON h.thermostat_id = t.id;

DROP VIEW IF EXISTS thermostat_daily_runtime;
CREATE VIEW thermostat_daily_runtime AS
WITH readings_with_next AS (
  SELECT
    *,
    date(timestamp / 1000, 'unixepoch') AS day,
    LEAD(timestamp) OVER (PARTITION BY ip ORDER BY timestamp) AS next_ts
  FROM thermostat_readings
)
SELECT
  day,
  ip,
  ROUND(SUM(
    CASE WHEN fstate != 0 THEN (next_ts - timestamp) / 1000.0 ELSE 0 END
  ) / 60.0, 2) AS fan_minutes,
  ROUND(SUM(
    CASE WHEN tstate != 0 THEN (next_ts - timestamp) / 1000.0 ELSE 0 END
  ) / 60.0, 2) AS compressor_minutes
FROM readings_with_next
WHERE next_ts IS NOT NULL
GROUP BY day, ip;

DROP VIEW IF EXISTS thermostat_runtime_vs_target;
CREATE VIEW thermostat_runtime_vs_target AS
WITH readings_with_next AS (
  SELECT
    *,
    date(timestamp / 1000, 'unixepoch') AS day,
    LEAD(timestamp) OVER (PARTITION BY ip ORDER BY timestamp) AS next_ts
  FROM thermostat_readings
)
SELECT
  day,
  ip,
  ROUND(AVG(ttemp), 1) AS avg_target_temp,
  ROUND(SUM(
    CASE WHEN tstate != 0 THEN (next_ts - timestamp) / 1000.0 ELSE 0 END
  ) / 60.0, 2) AS compressor_minutes
FROM readings_with_next
WHERE next_ts IS NOT NULL
GROUP BY day, ip;

DROP TRIGGER IF EXISTS log_tstate_cycle;
CREATE TRIGGER log_tstate_cycle
AFTER INSERT ON scan_data
FOR EACH ROW
BEGIN
    -- Case 1: INSERT new cycle if tstate = 1 and no open cycle exists
    INSERT INTO tstate_cycles (
        thermostat_id,
        tmode,
        start_timestamp,
        start_time
    )
    SELECT
        NEW.thermostat_id,
        NEW.tmode,
        NEW.timestamp,
        datetime(NEW.timestamp / 1000, 'unixepoch')
    WHERE NEW.tstate != 0
      AND NOT EXISTS (
          SELECT 1 FROM tstate_cycles
          WHERE thermostat_id = NEW.thermostat_id
            AND stop_timestamp IS NULL
      );

    -- Case 2: UPDATE last open cycle if tstate = 0
    UPDATE tstate_cycles
    SET stop_timestamp = NEW.timestamp,
        stop_time = datetime(NEW.timestamp / 1000, 'unixepoch'),
        run_time = ROUND((NEW.timestamp - start_timestamp) / 60000.0, 2)
    WHERE thermostat_id = NEW.thermostat_id
      AND stop_timestamp IS NULL
      AND NEW.tstate = 0;
END;

DROP TRIGGER IF EXISTS log_fstate_cycle;
CREATE TRIGGER log_fstate_cycle
AFTER INSERT ON scan_data
FOR EACH ROW
BEGIN
    -- Case 1: INSERT new cycle if fstate = 1 and no open cycle exists
    INSERT INTO fstate_cycles (
        thermostat_id,
        tmode,
        start_timestamp
        start_time
    )
    SELECT
        NEW.thermostat_id,
        NEW.tmode,
        NEW.timestamp,
        datetime(NEW.timestamp / 1000, 'unixepoch')
    WHERE NEW.fstate = 1
      AND NOT EXISTS (
          SELECT 1 FROM fstate_cycles
          WHERE thermostat_id = NEW.thermostat_id
            AND stop_timestamp IS NULL
      );

    -- Case 2: UPDATE last open cycle if fstate = 0
    UPDATE fstate_cycles
    SET stop_timestamp = NEW.timestamp,
        stop_time = datetime(NEW.timestamp / 1000, 'unixepoch'),
        run_time = ROUND((NEW.timestamp - start_timestamp) / 60000.0, 2)
    WHERE thermostat_id = NEW.thermostat_id
      AND stop_timestamp IS NULL
      AND NEW.fstate = 0;
END;

DROP VIEW IF EXISTS view_user_sessions;
CREATE VIEW view_user_sessions AS
SELECT *,
	datetime(createdAt, 'unixepoch') as CreatedTime,
	datetime(expiresAt, 'unixepoch') as ExpireTime,
	strftime('%Y-%m-%d %I:%M %p', createdAt, 'unixepoch', 'localtime') AS createdAt_local,
	strftime('%Y-%m-%d %I:%M %p', expiresAt, 'unixepoch', 'localtime') AS expiresAt_local
FROM user_sessions

DROP VIEW IF EXISTS view_fstate_cycles;
CREATE VIEW view_fstate_cycles AS
SELECT *,
	strftime('%Y-%m-%d %I:%M %p', start_timestamp / 1000, 'unixepoch', 'localtime') AS start_local,
	strftime('%Y-%m-%d %I:%M %p', stop_timestamp / 1000, 'unixepoch', 'localtime') AS stop_local
FROM fstate_cycles

DROP VIEW IF EXISTS view_tstate_cycles;
CREATE VIEW view_tstate_cycles AS
SELECT *,
	strftime('%Y-%m-%d %I:%M %p', start_timestamp / 1000, 'unixepoch', 'localtime') AS start_local,
	strftime('%Y-%m-%d %I:%M %p', stop_timestamp / 1000, 'unixepoch', 'localtime') AS stop_local
FROM tstate_cycles

DROP VIEW IF EXISTS view_tstate_daily_runtime;
CREATE VIEW view_tstate_daily_runtime AS
SELECT 
  date(start_timestamp / 1000, 'unixepoch', 'localtime') as run_date,
  SUM(run_time) AS total_runtime_hr
FROM tstate_cycles
GROUP BY run_date
ORDER BY run_date;

DROP VIEW IF EXISTS view_tstate_daily_mode_runtime;
CREATE VIEW view_tstate_daily_mode_runtime AS
SELECT 
  date(start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
  tmode,
  SUM(run_time) AS total_runtime_hr
FROM tstate_cycles
GROUP BY run_date, tmode
ORDER BY run_date, tmode;

DROP VIEW IF EXISTS view_tstate_hourly_runtime_today;
CREATE VIEW view_tstate_hourly_runtime_today AS
SELECT 
  datetime(strftime('%Y-%m-%d %H:00', start_timestamp / 1000, 'unixepoch', 'localtime')) AS run_hour,
  SUM(run_time) AS total_runtime_hr
FROM tstate_cycles
GROUP BY run_hour
ORDER BY run_hour;

DROP VIEW IF EXISTS view_tstate_hourly_env;
CREATE VIEW view_tstate_hourly_env AS
WITH hourly_env AS (
  SELECT 
    datetime(strftime('%Y-%m-%d %H:00', timestamp / 1000, 'unixepoch', 'localtime')) AS env_hour,
    AVG(outdoor_temp) AS avg_outdoor_temp,
    MIN(outdoor_temp) AS min_outdoor_temp,
    MAX(outdoor_temp) AS max_outdoor_temp,
    AVG(cloud_cover) AS avg_cloud_cover,
    AVG(rainIntensity) AS avg_rain_intensity,
    SUM(rainAccumulation) AS total_rain_accumulation,
    COUNT(*) AS sample_count
  FROM scan_data
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
  e.sample_count
FROM tstate_cycles c
LEFT JOIN hourly_env e
  ON datetime(strftime('%Y-%m-%d %H:00', c.start_timestamp / 1000, 'unixepoch', 'localtime')) = e.env_hour
GROUP BY run_hour
ORDER BY run_hour;

DROP VIEW IF EXISTS view_fan_vs_hvac_daily;
CREATE VIEW view_fan_vs_hvac_daily AS
SELECT 
  date(t.start_timestamp / 1000, 'unixepoch', 'localtime') AS run_date,
  SUM(t.run_time) AS hvac_runtime_hr,
  SUM(f.run_time) AS fan_runtime_hr
FROM tstate_cycles t
JOIN fstate_cycles f
  ON date(t.start_timestamp / 1000, 'unixepoch', 'localtime') =
     date(f.start_timestamp / 1000, 'unixepoch', 'localtime')
GROUP BY run_date
ORDER BY run_date;

-- Create segmented cycle table
CREATE TABLE IF NOT EXISTS cycle_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL,
    cycle_id INTEGER NOT NULL,
    segment_start INTEGER NOT NULL,       -- Unix timestamp (ms)
    segment_end INTEGER NOT NULL,         -- Unix timestamp (ms)
    segment_runtime INTEGER NOT NULL,     -- Duration in ms
    run_hour TEXT NOT NULL,               -- 'YYYY-MM-DD HH:00:00'
    FOREIGN KEY (thermostat_id) REFERENCES thermostats(id),
    FOREIGN KEY (cycle_id) REFERENCES tstate_cycles(id)
);

-- View for hourly runtime aggregation
CREATE VIEW IF NOT EXISTS view_cycle_hourly_runtime AS
SELECT 
    thermostat_id,
    run_hour,
    SUM(segment_runtime) / 60000.0 AS total_runtime_minutes
FROM cycle_segments
GROUP BY thermostat_id, run_hour
ORDER BY run_hour;

CREATE TABLE IF NOT EXISTS compressors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER REFERENCES thermostats(id),
    model TEXT,
    rla REAL,
    lra REAL,
    voltage TEXT,
    phase INTEGER,
    hertz INTEGER,
    hp REAL,
    refrigerant TEXT,
    charge_oz REAL,
    charge_kg REAL,
    pressure_high REAL,
    pressure_low REAL,
    ampacity_min REAL,
    breaker_max REAL
);

CREATE TABLE IF NOT EXISTS thermostat_compressor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thermostat_id INTEGER NOT NULL REFERENCES thermostats(id),
    compressor_id INTEGER NOT NULL REFERENCES compressors(id),
    UNIQUE(thermostat_id, compressor_id)
);

DROP VIEW IF EXISTS view_hvac_systems;
CREATE VIEW view_hvac_systems AS
SELECT 
  t.*,
  c.model,
  c.rla,
  c.lra,
  c.voltage,
  c.phase,
  c.hertz,
  c.hp,
  c.refrigerant,
  c.charge_oz,
  c.charge_kg,
  c.pressure_high,
  c.pressure_low,
  c.ampacity_min,
  c.breaker_max
FROM thermostats t
JOIN compressors c
  ON c.thermostat_id = t.id
