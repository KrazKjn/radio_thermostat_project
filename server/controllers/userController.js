const db = require('../../db');
const bcrypt = require("bcryptjs");

const getUser = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const searchToken = authHeader.split(" ")[1];
      const session = db.prepare('SELECT * FROM user_sessions WHERE sessionToken = ?').get(searchToken);
      if (!session || session.expiresAt < Math.floor(Date.now() / 1000)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json(user);
    }
    res.status(401).json({ error: "Unauthorized" });
};

const getUsers = async (req, res) => {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.enabled, r.name as role, u.roleId
      FROM users u
      JOIN roles r ON u.roleId = r.id
    `).all();
    res.json(users);
};

const addUser = async (req, res) => {
    const { username, email, password, roleId } = req.body;
    if (!username || !email || !password || !roleId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare(`
      INSERT INTO users (username, email, password, roleId, enabled)
      VALUES (?, ?, ?, ?, 1)
    `).run(username, email, hashedPassword, roleId);
    res.json({ message: "User added" });
};

const updateUser = async (req, res) => {
    const { email, roleId, password, enabled } = req.body;
    const { id } = req.params;
    let query = "UPDATE users SET ";
    const params = [];
    if (email) {
      query += "email = ?, ";
      params.push(email);
    }
    if (roleId) {
      query += "roleId = ?, ";
      params.push(roleId);
    }
    if (password) {
      query += "password = ?, ";
      params.push(bcrypt.hashSync(password, 10));
    }
    if (enabled !== undefined) {
      query += "enabled = ?, ";
      params.push(enabled ? 1 : 0);
    }
    query = query.replace(/, $/, " "); // Remove trailing comma
    query += "WHERE id = ?";
    params.push(id);
    db.prepare(query).run(...params);
    res.json({ message: "User updated" });
};

const enableUser = async (req, res) => {
    const { id } = req.params;
    const { enable } = req.body;
    db.prepare("UPDATE users SET enabled = ? WHERE id = ?").run(enable, id);
    res.json({ message: "User enabled/disabled" });
};

const getRoles = async (req, res) => {
    const roles = db.prepare(`
      SELECT * FROM roles
    `).all();
    res.json(roles);
};

module.exports = {
    getUser,
    getUsers,
    addUser,
    updateUser,
    enableUser,
    getRoles,
};
