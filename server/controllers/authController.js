const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require('../../db');
const SECRET_KEY = process.env.SECRET_KEY || "your_secret_key";

const login = async (req, res) => {
    const { username, password } = req.body;
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (row.count === 0) {
      // No users exist, create the first admin user
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (username, email, password, roleId) VALUES (?, ?, ?, ?)
      `);
      console.log(`Creating first admin user. username: ${username}, email: ${username}@test.net, password: ${hashedPassword}, role: admin`);
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
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token
    const expiresInSec = 60 * 60; // 1 hour
    const token = jwt.sign({ username: user.username, role: user.role }, SECRET_KEY, { expiresIn: expiresInSec });

    // Persist session in user_sessions table
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + expiresInSec;
    const result = db.prepare('DELETE FROM user_sessions WHERE expiresAt < ?').run(now);
    if (result.changes > 0) {
      console.log(`Purged expired sessions`);
    }
    db.prepare(`
      INSERT INTO user_sessions (userId, sessionToken, createdAt, expiresAt)
      VALUES (?, ?, ?, ?)
    `).run(user.id, token, now, expiresAt);

    res.json({ token, user: { username: user.username, role: user.role } });
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
        res.json({ message: "Logged out" });
    } else {
        res.status(400).json({ error: "No token provided for logout" });
    }
};

const tokenInfo = (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const oldToken = req.body?.oldToken;
      const decoded = jwt.decode(token);
      if (decoded) {
        if (oldToken && oldToken !== token) {
          // Invalidate the old token in the database
          db.prepare(`
              UPDATE user_sessions
              SET sessionToken = ?, createdAt = ?, expiresAt = ?
              WHERE sessionToken = ?
            `).run(token, now, decoded.exp, oldToken);
        }
        res.json({
          username: decoded.username,
          role: decoded.role,
          exp: decoded.exp,
          iat: decoded.iat
        });
      } else {
        res.status(401).json({ error: "Invalid token" });
      }
    }
};

module.exports = {
    login,
    logout,
    tokenInfo,
};
