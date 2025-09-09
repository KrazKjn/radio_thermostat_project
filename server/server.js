require("dotenv").config(); // If using dotenv for env vars
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require('./routes'); // Entry point for all route definitions

const app = express();

app.use(cors()); // Enables Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Enable JSON parsing; Parses incoming JSON payloads
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' })); // Parses raw binary payloads

app.use('/', routes); // Mounts all routes at root path

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Proxy running at http://localhost:${PORT}`));
