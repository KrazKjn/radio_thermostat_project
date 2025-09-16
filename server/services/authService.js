const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";
const SERVICE_TOKEN_PAYLOAD = { username: "service", role: "service" };
const SERVICE_TOKEN_EXPIRY = "30d"; // or as needed

let SERVICE_TOKEN;
let SERVICE_TOKEN_EXP;

// Function to generate a new service token
function generateServiceToken() {
    return jwt.sign(SERVICE_TOKEN_PAYLOAD, SECRET_KEY, { expiresIn: SERVICE_TOKEN_EXPIRY });
}

// Store the current service token and its expiration
SERVICE_TOKEN = generateServiceToken();
SERVICE_TOKEN_EXP = jwt.decode(SERVICE_TOKEN).exp * 1000; // ms

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

module.exports = {
    generateServiceToken,
    getValidServiceToken,
};
