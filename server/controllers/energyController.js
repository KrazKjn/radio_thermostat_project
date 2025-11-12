const db = require('../../db');
const Logger = require('../../components/Logger');

const getEnergyCosting = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM energy_costing').all();
        res.json(rows);
    } catch (error) {
        Logger.error(`Error in getEnergyCosting: ${error.message}`, 'EnergyController', 'getEnergyCosting');
        res.status(500).json({ error: 'Failed to retrieve energy costing data' });
    }
};

const addEnergyCosting = (req, res) => {
    try {
        const { effective_start_date, energy_type_id, cost_per_unit, unit_type_id } = req.body;
        const stmt = db.prepare(`
            INSERT INTO energy_costing (effective_start_date, energy_type_id, cost_per_unit, unit_type_id)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(effective_start_date, energy_type_id, cost_per_unit, unit_type_id);
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (error) {
        Logger.error(`Error in addEnergyCosting: ${error.message}`, 'EnergyController', 'addEnergyCosting');
        res.status(500).json({ error: 'Failed to add energy costing data' });
    }
};

const updateEnergyCosting = (req, res) => {
    try {
        const { id } = req.params;
        const { effective_start_date, energy_type_id, cost_per_unit, unit_type_id } = req.body;
        const stmt = db.prepare(`
            UPDATE energy_costing
            SET effective_start_date = ?, energy_type_id = ?, cost_per_unit = ?, unit_type_id = ?
            WHERE id = ?
        `);
        const info = stmt.run(effective_start_date, energy_type_id, cost_per_unit, unit_type_id, id);
        if (info.changes > 0) {
            res.json({ message: 'Energy costing data updated successfully' });
        } else {
            res.status(404).json({ error: 'Energy costing data not found' });
        }
    } catch (error) {
        Logger.error(`Error in updateEnergyCosting: ${error.message}`, 'EnergyController', 'updateEnergyCosting');
        res.status(500).json({ error: 'Failed to update energy costing data' });
    }
};

const deleteEnergyCosting = (req, res) => {
    try {
        const { id } = req.params;
        const stmt = db.prepare('DELETE FROM energy_costing WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes > 0) {
            res.json({ message: 'Energy costing data deleted successfully' });
        } else {
            res.status(404).json({ error: 'Energy costing data not found' });
        }
    } catch (error) {
        Logger.error(`Error in deleteEnergyCosting: ${error.message}`, 'EnergyController', 'deleteEnergyCosting');
        res.status(500).json({ error: 'Failed to delete energy costing data' });
    }
};

const getEnergyTypes = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM energy_types').all();
        res.json(rows);
    } catch (error) {
        Logger.error(`Error in getEnergyTypes: ${error.message}`, 'EnergyController', 'getEnergyTypes');
        res.status(500).json({ error: 'Failed to retrieve energy types data' });
    }
};

const getUnitTypes = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM unit_types').all();
        res.json(rows);
    } catch (error) {
        Logger.error(`Error in getUnitTypes: ${error.message}`, 'EnergyController', 'getUnitTypes');
        res.status(500).json({ error: 'Failed to retrieve unit types data' });
    }
};

module.exports = {
    getEnergyCosting,
    addEnergyCosting,
    updateEnergyCosting,
    deleteEnergyCosting,
    getEnergyTypes,
    getUnitTypes
};
