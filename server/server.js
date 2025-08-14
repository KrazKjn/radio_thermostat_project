require("dotenv").config(); // If using dotenv for env vars
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(bodyParser.json()); // Enable JSON parsing
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));

app.use('/', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Proxy running at http://localhost:${PORT}`));
