const express = require('express');
const router = express.Router();
const { authenticateToken, refreshTokenMiddleware } = require('../middleware/auth');
const thermostatController = require('../controllers/thermostatController');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const weatherController = require('../controllers/weatherController');

// Helper to apply both middlewares
const authWithRefresh = [authenticateToken, refreshTokenMiddleware];

// Auth
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/tokenInfo', authController.tokenInfo);

// User
router.get('/user', authWithRefresh, userController.getUser);
router.get('/users', authWithRefresh, userController.getUsers);
router.post('/users', authWithRefresh, userController.addUser);
router.put('/users/:id', authWithRefresh, userController.updateUser);
router.post('/users/:id/enabled', authWithRefresh, userController.enableUser);
router.get('/roles', authWithRefresh, userController.getRoles);

// Thermostat
router.get('/tstat/:ip', authWithRefresh, thermostatController.getThermostatData);
router.post("/tstat/:ip", authWithRefresh, thermostatController.updateThermostat);
router.get("/cache/:ip", authWithRefresh, thermostatController.getCache);
router.get("/model/:ip", authWithRefresh, thermostatController.getModel);
router.get("/name/:ip", authWithRefresh, thermostatController.getName);
router.get("/tswing/:ip", authWithRefresh, thermostatController.getSwing);
router.get("/thermostat/:ip", authWithRefresh, thermostatController.getThermostat);
router.get("/thermostat/detailed/:ip", authWithRefresh, thermostatController.getThermostatDetailed);
router.get("/schedule/:scheduleMode/:ip", authWithRefresh, thermostatController.getSchedule);
router.get("/cloud/:ip", authWithRefresh, thermostatController.getCloud);
router.post("/thermostat/name/:ip", authWithRefresh, thermostatController.updateName);
router.post("/thermostat/reboot/:ip", authWithRefresh, thermostatController.rebootServer);
router.post("/tswing/:ip", authWithRefresh, thermostatController.updateSwing);
router.post("/schedule/:scheduleMode/:ip", authWithRefresh, thermostatController.updateSchedule);
router.post("/schedule/:scheduleMode/:day/:ip", authWithRefresh, thermostatController.updateScheduleDay);
router.post("/cloud/:ip", authWithRefresh, thermostatController.updateCloud);

// Scanner
router.post("/scanner/start/:ip", authWithRefresh, thermostatController.startScanner);
router.post("/scanner/stop/:ip", authWithRefresh, thermostatController.stopScanner);
router.get("/scanner/status", authWithRefresh, thermostatController.getScannerStatus);
router.get("/scanner/data/:ip", authWithRefresh, thermostatController.getScannerData);
router.get("/scanner/details", authWithRefresh, thermostatController.getScannerDetails);
router.post("/scanner/restart/:ip", authWithRefresh, thermostatController.restartScanner);

// Usage
router.get("/usage/daily/:ip", authWithRefresh, thermostatController.getDailyUsage);

// Statistics
router.get("/stats/daily-runtime/:ip", authWithRefresh, thermostatController.getDailyRuntime);
router.get("/stats/hourly-runtime/:ip", authWithRefresh, thermostatController.getHourlyRuntime);
router.get("/stats/daily-mode-runtime/:ip", authWithRefresh, thermostatController.getDailyModeRuntime);
router.get("/stats/hourly-env/:ip", authWithRefresh, thermostatController.getHourlyEnv);
router.get("/stats/fan-vs-hvac-daily/:ip", authWithRefresh, thermostatController.getFanVsHvacDaily);
router.get("/stats/temp-vs-runtime/:ip", authWithRefresh, thermostatController.getTempVsRuntime);

// Thermostats
router.get("/thermostats", authWithRefresh, thermostatController.getThermostats);
router.post("/thermostats", authWithRefresh, thermostatController.addThermostat);
router.put("/thermostats/:ip", authWithRefresh, thermostatController.updateThermostats);
router.delete("/thermostats/:ip", authWithRefresh, thermostatController.deleteThermostat);
router.get("/thermostatscan/:subnet", authWithRefresh, thermostatController.scanThermostats);

// Cloud data
// router.post('/captureStatIn', authWithRefresh, thermostatController.captureStatIn);
router.post('/captureStatIn', thermostatController.captureStatIn);

// Weather
router.get('/weather', authWithRefresh, weatherController.getWeather);

module.exports = router;
