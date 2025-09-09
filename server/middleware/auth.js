const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key"; // Use a strong key in production

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    // console.log(`authenticateToken received: ${token}`);
	if (!token) console.log("Unauthorized (401): No token provided");
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
	    if (err) console.log("Forbidden (403): Forbidden: Invalid token");
        if (err) return res.status(403).json({ error: "Forbidden: Invalid token" });

        req.user = user;
        next();
    });
};

module.exports = { authenticateToken };
