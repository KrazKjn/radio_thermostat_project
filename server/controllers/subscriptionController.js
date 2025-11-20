const db = require('../../db'); // Adjust path as needed

const getAllSubscriptions = (req, res) => {
  const userId = req.user.id;
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
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

const createSubscription = (req, res) => {
  const userId = req.user.id;
  const { thermostat_id, report_type } = req.body;

  if (!thermostat_id || !report_type) {
    return res.status(400).json({ error: 'Thermostat ID and report type are required.' });
  }

  const sql = 'INSERT INTO report_subscriptions (user_id, thermostat_id, report_type) VALUES (?, ?, ?)';
  db.run(sql, [userId, thermostat_id, report_type], function (err) {
    if (err) {
      if (err.errno === 19) {
        return res.status(409).json({ error: 'Subscription already exists for this thermostat and report type.' });
      }
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: this.lastID });
  });
};

const updateSubscription = (req, res) => {
  const userId = req.user.id;
  const subscriptionId = req.params.id;
  const { is_active } = req.body;

  if (typeof is_active === 'undefined') {
    return res.status(400).json({ error: 'is_active field is required.' });
  }

  const checkSql = 'SELECT user_id FROM report_subscriptions WHERE id = ?';
  db.get(checkSql, [subscriptionId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Subscription not found.' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden: You do not own this subscription.' });

    const updateSql = 'UPDATE report_subscriptions SET is_active = ? WHERE id = ?';
    db.run(updateSql, [is_active, subscriptionId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Subscription updated successfully.', changes: this.changes });
    });
  });
};

const deleteSubscription = (req, res) => {
  const userId = req.user.id;
  const subscriptionId = req.params.id;

  const checkSql = 'SELECT user_id FROM report_subscriptions WHERE id = ?';
  db.get(checkSql, [subscriptionId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Subscription not found.' });
    if (row.user_id !== userId) return res.status(403).json({ error: 'Forbidden: You do not own this subscription.' });

    const deleteSql = 'DELETE FROM report_subscriptions WHERE id = ?';
    db.run(deleteSql, [subscriptionId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Subscription not found.' });
      res.status(204).send();
    });
  });
};

module.exports = {
  getAllSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};