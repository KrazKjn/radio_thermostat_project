const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key"; // Use a strong key in production
const RENEW_WITHIN_MINUTES = 15;

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) console.log("Unauthorized (401): No token provided");
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) console.log("Forbidden (403): Forbidden: Invalid token");
        if (err) return res.status(403).json({ error: "Forbidden: Invalid token" });

        req.user = user;
        next();
    });
};

// Sliding session: refresh token middleware
const refreshTokenMiddleware = (req, res, next) => {
    if (req.user) {
        const authHeader = req.headers['authorization'];
        const currentToken = authHeader && authHeader.startsWith('Bearer ')
            ? authHeader.slice(7) // Remove "Bearer " prefix
            : null;
        let renewToken = false;

        if (currentToken) {
            const decoded = jwt.decode(currentToken);
            if (decoded?.exp) {
                const expDate = new Date(decoded.exp * 1000);
                const now = Date.now(); // Current time in milliseconds
                const expiresInMs = expDate.getTime() - now;

                if (expiresInMs <= RENEW_WITHIN_MINUTES * 60 * 1000) {
                    console.log("Token will expire in 15 minutes or less.");
                    renewToken = true;
                }
                console.log(`Current token expires at: ${expDate.toLocaleString()}`);
            } else {
                console.log("Current token does not contain an expiration (exp) claim.");
            }
        } else {
            console.log("No current token found in Authorization header.");
        }

        if (renewToken) {
            // Generate a new token with fresh expiration
            const payload = { username: req.user.username, role: req.user.role };
            const newToken = jwt.sign(payload, SECRET_KEY, { expiresIn: "1h" });
            res.setHeader("Access-Control-Expose-Headers", "x-refreshed-token");
            res.setHeader("x-refreshed-token", newToken);

            // Decode the token without verifying signature
            const decoded = jwt.decode(newToken);

            if (decoded && decoded.exp) {
                const expDate = new Date(decoded.exp * 1000); // Convert from seconds to milliseconds
                console.log(`Header updated with x-refreshed-token expiring: ${expDate.toLocaleString()}`);
            } else {
                console.log("Token does not contain an expiration (exp) claim.");
            }
        }
    }
    next();
};

module.exports = { authenticateToken, refreshTokenMiddleware };
