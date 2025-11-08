const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require('../../db');
const Logger = require('../../components/Logger');
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

const login = async (req, res) => {
    const { username, password } = req.body;
    const sourceIP = req.ip || req.connection.remoteAddress;
    Logger.info(`Login attempt for username: ${username} from IP: ${sourceIP}`, 'AuthController', 'login');
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (row.count === 0) {
      // No users exist, create the first admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password, roleId) VALUES (?, ?, ?, ?)
      `);
      Logger.info(`Creating first admin user. username: ${username}, email: ${username}@test.net, password: ${hashedPassword}, role: admin`, 'AuthController', 'login');
      stmt.run(
          username,
          `${username}@test.net`,
          hashedPassword,
          1
      );
    }
    const getUserStmt = db.prepare(`
      SELECT * FROM user_authorization WHERE username = ? COLLATE NOCASE;
    `);

    const user = getUserStmt.get(username);
    if (!user) {
      Logger.warn(`Invalid credentials for username: ${username} from IP: ${sourceIP}`, 'AuthController', 'login');
      return res.status(401).json({ error: "Invalid credentials" });
    }
    Logger.info(`User found for username: ${username}`, 'AuthController', 'login');

    if (!bcrypt.compareSync(password, user.password)) {
      Logger.warn(`Invalid password for username: ${username} from IP: ${sourceIP}`, 'AuthController', 'login');
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const expiresInSec = 60 * 60; // 1 hour
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + expiresInSec;

    // Purge expired sessions
    const purgeResult = db.prepare('DELETE FROM user_sessions WHERE expiresAt < ?').run(now);
    if (purgeResult.changes > 0) {
      Logger.info(`Purged expired sessions`, 'AuthController', 'login');
    }

    // Check for existing valid session
    const existingSession = db.prepare(`
      SELECT sessionToken, expiresAt
      FROM user_sessions
      WHERE userId = ? AND expiresAt > ?
      ORDER BY expiresAt DESC
      LIMIT 1
    `).get(user.id, now);

    let token = null;

    if (existingSession) {
      token = existingSession.sessionToken;
      Logger.info(`Reusing valid session token expiring at ${new Date(existingSession.expiresAt * 1000).toString()}: token: ${token}`, 'AuthController', 'login');
    } else {
      // Create new JWT token
      token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: expiresInSec });

      // Insert new session
      db.prepare(`
        INSERT INTO user_sessions (userId, sessionToken, createdAt, expiresAt)
        VALUES (?, ?, ?, ?)
      `).run(user.id, token, now, expiresAt);

      Logger.info(`Created new session token expiring at ${new Date(expiresAt * 1000).toString()}: ${token}`, 'AuthController', 'login');
    }

    res.status(200).json({ token, user: { username: user.username, role: user.role } });
};

const logout = (req, res) => {
    // Accept token from Authorization header, body, or query
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }
    if (!token && req.body.token) {
        token = req.body.token;
    }
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (token) {
        db.prepare('DELETE FROM user_sessions WHERE sessionToken = ?').run(token);
        res.status(200).json({ message: "Logged out" });
    } else {
        res.status(400).json({ error: "No token provided for logout" });
    }
};

const tokenInfo = (req, res) => {
    const token = req.query?.token;
    const debugLevel = Number.isFinite(Number(req.query?.debugLevel)) ? Number(req.query.debugLevel) : 6;
    Logger.debug(`Entering ...`, 'AuthController', 'tokenInfo', debugLevel);
    if (!token) {
      return res.status(400).json({ error: "No token provided" });
    }
    Logger.debug(`Decoding ${token} ...`, 'AuthController', 'tokenInfo', debugLevel);
    let decoded = jwt.decode(token);
    Logger.debug(`Decoding ${token} ... done`, 'AuthController', 'tokenInfo', debugLevel);
    if (decoded) {
      const now = Date.now(); // current time in milliseconds
      const twoHoursFromNow = now + (2 * 60 * 60 * 1000); // add 2 hours

      Logger.debug(`Checking for User or Service token ...`, 'AuthController', 'tokenInfo', debugLevel);
      if (new Date(decoded.exp * 1000) < twoHoursFromNow) {
        // User Token detected, check for oldToken to refresh in DB
        const newToken = req.query?.newToken;
        if (newToken !== undefined && newToken !== null) {
          Logger.debug(`New User Token Provided: newToken = ${newToken}, token = ${token}`, 'AuthController', 'tokenInfo', debugLevel);
          if (newToken !== token) {
            const now = Math.floor(Date.now() / 1000);
            // Invalidate the old token in the database
            Logger.debug(`Updating DB:user_sessions ...`, 'AuthController', 'tokenInfo', debugLevel);
            decoded = jwt.decode(newToken);
            db.prepare(`
                UPDATE user_sessions
                SET sessionToken = ?, createdAt = ?, expiresAt = ?
                WHERE sessionToken = ?
              `).run(newToken, now, decoded.exp, token);
            Logger.debug(`Updating DB:user_sessions ... done`, 'AuthController', 'tokenInfo', debugLevel);
          } else {
            Logger.debug(`oldToken and new token are the same.`, 'AuthController', 'tokenInfo', debugLevel);
          }
        } else{
          Logger.debug(`New User Token NOT Provided.`, 'AuthController', 'tokenInfo', debugLevel);
        }
      } else {
        Logger.debug(`Service token ...`, 'AuthController', 'tokenInfo', debugLevel);
      }
      res.status(200).json({
        username: decoded.username,
        role: decoded.role,
        exp: decoded.exp,
        iat: decoded.iat
      });
    } else {
      res.status(401).json({ error: "Invalid token" });
    }
    Logger.debug(`Exiting ...`, 'AuthController', 'tokenInfo', debugLevel);
};

module.exports = {
    login,
    logout,
    tokenInfo,
};
