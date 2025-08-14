const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const thermostatController = require('../controllers/thermostatController');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');

// Auth
router.post('/login', authController.login);
router.post('/logout', authenticateToken, authController.logout);
router.get('/tokenInfo', authenticateToken, authController.tokenInfo);

// User
router.get('/user', authenticateToken, userController.getUser);
router.get('/users', authenticateToken, userController.getUsers);
router.post('/users', authenticateToken, userController.addUser);
router.put('/users/:id', authenticateToken, userController.updateUser);
router.post('/users/:id/enabled', authenticateToken, userController.enableUser);
router.get('/roles', authenticateToken, userController.getRoles);


// Thermostat
router.get('/tstat/:ip', authenticateToken, thermostatController.getThermostatData);
router.post("/tstat/:ip", authenticateToken, thermostatController.updateThermostat);
router.get("/cache/:ip", authenticateToken, thermostatController.getCache);
router.get("/model/:ip", authenticateToken, thermostatController.getModel);
router.get("/name/:ip", authenticateToken, thermostatController.getName);
router.get("/tswing/:ip", authenticateToken, thermostatController.getSwing);
router.get("/thermostat/:ip", authenticateToken, thermostatController.getThermostat);
router.get("/thermostat/detailed/:ip", authenticateToken, thermostatController.getThermostatDetailed);
router.get("/schedule/:scheduleMode/:ip", authenticateToken, thermostatController.getSchedule);
router.get("/cloud/:ip", authenticateToken, thermostatController.getCloud);
router.post("/thermostat/name/:ip", authenticateToken, thermostatController.updateName);
router.post("/tswing/:ip", authenticateToken, thermostatController.updateSwing);
router.post("/schedule/:scheduleMode/:ip", authenticateToken, thermostatController.updateSchedule);
router.post("/schedule/:scheduleMode/:day/:ip", authenticateToken, thermostatController.updateScheduleDay);
router.post("/cloud/:ip", authenticateToken, thermostatController.updateCloud);

// Scanner
router.post("/scanner/start/:ip", authenticateToken, thermostatController.startScanner);
router.post("/scanner/stop/:ip", authenticateToken, thermostatController.stopScanner);
router.get("/scanner/status", authenticateToken, thermostatController.getScannerStatus);
router.get("/scanner/data/:ip", authenticateToken, thermostatController.getScannerData);
router.get("/scanner/details", authenticateToken, thermostatController.getScannerDetails);
router.post("/scanner/restart/:ip", authenticateToken, thermostatController.restartScanner);

// Usage
router.get("/usage/daily/:ip", authenticateToken, thermostatController.getDailyUsage);

// Thermostats
router.get("/thermostats", authenticateToken, thermostatController.getThermostats);
router.post("/thermostats", authenticateToken, thermostatController.addThermostat);
router.put("/thermostats/:ip", authenticateToken, thermostatController.updateThermostats);
router.delete("/thermostats/:ip", authenticateToken, thermostatController.deleteThermostat);
router.get("/thermostatscan/:subnet", authenticateToken, thermostatController.scanThermostats);

// Cloud data
router.post('/captureStatIn', authenticateToken, thermostatController.captureStatIn);


module.exports = router;
