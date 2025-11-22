const db = require('../../db'); // Adjust path as needed

const getAllSubscriptions = (req, res) => {
  const userId = req.user.id;
  try {
    const sql = `
      SELECT
        rs.id,
        rs.thermostat_id,
        t.location AS thermostat_location,
        rs.report_type,
        rs.is_active
      FROM report_subscriptions rs
      JOIN thermostats t ON rs.thermostat_id = t.id
      WHERE rs.user_id = ?
    `;
    const stmt = db.prepare(sql);
    const rows = stmt.all(userId);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createSubscription = (req, res) => {
  const userId = req.user.id;
  const { thermostat_id, report_type } = req.body;

  if (!thermostat_id || !report_type) {
    return res.status(400).json({ error: 'Thermostat ID and report type are required.' });
  }

  try {
    const sql = 'INSERT INTO report_subscriptions (user_id, thermostat_id, report_type) VALUES (?, ?, ?)';
    const stmt = db.prepare(sql);
    const info = stmt.run(userId, thermostat_id, report_type);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Subscription already exists for this thermostat and report type.' });
    }
    res.status(500).json({ error: err.message });
  }
};

const updateSubscription = (req, res) => {
  const userId = req.user.id;
  const subscriptionId = req.params.id;
  const { is_active } = req.body;

  if (typeof is_active === 'undefined') {
    return res.status(400).json({ error: 'is_active field is required.' });
  }

  try {
    const checkSql = 'SELECT user_id FROM report_subscriptions WHERE id = ?';
    const checkStmt = db.prepare(checkSql);
    const row = checkStmt.get(subscriptionId);

    if (!row) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }
    if (row.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this subscription.' });
    }

    const updateSql = 'UPDATE report_subscriptions SET is_active = ? WHERE id = ?';
    const updateStmt = db.prepare(updateSql);
    const info = updateStmt.run(is_active, subscriptionId);
    res.json({ message: 'Subscription updated successfully.', changes: info.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteSubscription = (req, res) => {
  const userId = req.user.id;
  const subscriptionId = req.params.id;

  try {
    const checkSql = 'SELECT user_id FROM report_subscriptions WHERE id = ?';
    const checkStmt = db.prepare(checkSql);
    const row = checkStmt.get(subscriptionId);

    if (!row) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }
    if (row.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this subscription.' });
    }

    const deleteSql = 'DELETE FROM report_subscriptions WHERE id = ?';
    const deleteStmt = db.prepare(deleteSql);
    const info = deleteStmt.run(subscriptionId);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Subscription not found.' });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};