const db = require('../../db');
const Logger = require('../../components/Logger');
const {
    calculateKwHsUsed,
    calculateCoolingCost,
    calculateGallonsConsumed,
    calculateHeatingCost,
    calculateFanKwHsUsed,
    calculateFanCost,
} = require('../../utils/costing');
const { ENERGY_TYPES } = require('../../constants/energy');
const { HVAC_MODE_COOL, HVAC_MODE_HEAT } = require('../../constants/hvac_mode');
const MAX_CYCLE_RUNTIME_MINUTES = 120.0; // 2 hours
const MIN_CYCLE_RUNTIME_MINUTES = 2.0; // 2 minutes


const getEnergyCosting = (req, res) => {
    try {
        const rows = db.prepare('SELECT * FROM view_energy_costing').all();
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

const createSummary = () => ({
  total: { cost: 0, runtime: 0 },
  heating: { cost: 0, consumption: 0, fan: { cost: 0, runtime: 0 } },
  cooling: { cost: 0, consumption: 0, fan: { cost: 0, runtime: 0 } }
});

const updateSummary = (summary, cycleData, type, tmode) => {
  summary.total.cost += cycleData.cost;
  summary.total.runtime += cycleData.runtime;

  const isCooling = tmode === HVAC_MODE_COOL;
  const target = isCooling ? summary.cooling : summary.heating;

  if (type === 'hvac') {
    target.cost += cycleData.cost;
    target.consumption += cycleData.consumption;
  } else if (type === 'fan') {
    target.fan.cost += cycleData.cost;
    target.fan.runtime += cycleData.runtime;
  }
};

const getConsumptionReport = (req, res) => {
    try {
        const { ip } = req.params;
        let whereClause = '';
        if (ip && ip.length > 0 && ip !== 'all') {
            whereClause = `WHERE t.ip = '${ip}'`;
        }

        const hvac_systems = db.prepare(`
            SELECT
                t.id as thermostat_id,
                c.heat_source_id,
                c.voltage as compressor_voltage,
                c.rla,
                f.voltage as fan_voltage,
                f.rated_amps as fan_rated_amps,
                c.btu_per_hr_high,
                c.btu_per_hr_low,
                c.capacity AS tons
            FROM thermostats t
            JOIN compressors c ON c.thermostat_id = t.id
            JOIN fan_motors f ON t.id = f.thermostat_id
            ${whereClause}
        `).all();

        if (!hvac_systems) {
            return res.status(404).json({ error: "Thermostat with detailed HVAC system not found" });
        }

        const energyCosts = db.prepare('SELECT * FROM energy_costing ORDER BY effective_start_date DESC').all();

        const getCostForDate = (energy_type_id, date) => {
            const timestamp = new Date(date).getTime();
            const cost = energyCosts.find(c =>
                c.energy_type_id === energy_type_id &&
                new Date(c.effective_start_date).getTime() <= timestamp
            );
            return cost ? cost.cost_per_unit : null;
        };

        const processedCycles = [];

        hvac_systems.forEach(system => {
            const { thermostat_id, heat_source_id } = system;

            const hvacCycles = db.prepare(`SELECT * FROM view_tstate_cycles WHERE thermostat_id = ? AND run_time >= ? AND run_time <= ?`).all(thermostat_id, MIN_CYCLE_RUNTIME_MINUTES, MAX_CYCLE_RUNTIME_MINUTES);
            const fanCycles = db.prepare(`SELECT * FROM view_fstate_cycles WHERE thermostat_id = ? AND run_time >= ? AND run_time <= ?`).all(thermostat_id, MIN_CYCLE_RUNTIME_MINUTES, MAX_CYCLE_RUNTIME_MINUTES);

            hvacCycles.forEach(cycle => {
                if (cycle.run_time === null) return;
                const isCooling = cycle.tmode === HVAC_MODE_COOL;
                const energy_type_id = isCooling ? ENERGY_TYPES.ELECTRICITY : heat_source_id;
                const cost_per_unit = getCostForDate(energy_type_id, cycle.run_date);

                let cost = 0;
                let consumption = 0;

                if (cost_per_unit !== null) {
                    cost = isCooling
                        ? calculateCoolingCost(cycle.run_time, system, cost_per_unit)
                        : calculateHeatingCost(cycle.run_time, system, cost_per_unit);
                    consumption = isCooling
                        ? calculateKwHsUsed(cycle.run_time, system)
                        : calculateGallonsConsumed(cycle.run_time, system);
                }

                processedCycles.push({ ...cycle, cost, consumption, type: 'hvac', tmode: cycle.tmode });
            });

            fanCycles.forEach(cycle => {
                if (cycle.run_time === null) return;
                const cost_per_unit = getCostForDate(ENERGY_TYPES.ELECTRICITY, cycle.run_date);

                let cost = 0;
                let consumption = 0;

                if (cost_per_unit !== null) {
                    cost = calculateFanCost(cycle.run_time, system, cost_per_unit);
                    consumption = calculateFanKwHsUsed(cycle.run_time, system);
                }

                processedCycles.push({ ...cycle, cost, consumption, type: 'fan', tmode: null }); // Fan doesn't have tmode
            });
        });

        const report = {};

        const getWeek = (d, weekStart = 'Sunday') => {
            const date = new Date(d);
            const day = date.getDay(); // Sunday - Saturday : 0 - 6

            // Adjust date to the start of the week.
            let dayOfWeek;
            switch(weekStart.toLowerCase()) {
                case 'monday':
                    dayOfWeek = (day === 0) ? 6 : day - 1;
                    break;
                case 'sunday':
                default:
                    dayOfWeek = day;
                    break;
            }
            date.setDate(date.getDate() - dayOfWeek);

            const yearStart = new Date(date.getFullYear(), 0, 1);
            const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);

            return weekNo;
        };

        const weekStartDay = process.env.DEFAULT_WEEK_START || 'Sunday';

        processedCycles.forEach(cycle => {
            const date = new Date(cycle.start_timestamp);
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const week = getWeek(date, weekStartDay);
            const day = cycle.run_date;

            if (!report[year]) report[year] = { summary: createSummary(), months: {} };
            if (!report[year].months[month]) report[year].months[month] = { summary: createSummary(), weeks: {} };
            if (!report[year].months[month].weeks[week]) report[year].months[month].weeks[week] = { summary: createSummary(), days: {} };
            if (!report[year].months[month].weeks[week].days[day]) report[year].months[month].weeks[week].days[day] = createSummary();

            const cycleData = {
                runtime: cycle.run_time,
                cost: cycle.cost,
                consumption: cycle.consumption
            };

            updateSummary(report[year].summary, cycleData, cycle.type, cycle.tmode);
            updateSummary(report[year].months[month].summary, cycleData, cycle.type, cycle.tmode);
            updateSummary(report[year].months[month].weeks[week].summary, cycleData, cycle.type, cycle.tmode);
            updateSummary(report[year].months[month].weeks[week].days[day], cycleData, cycle.type, cycle.tmode);
        });

        res.json(report);

    } catch (error) {
        Logger.error(`Error in getConsumptionReport: ${error.message}`, 'EnergyController', 'getConsumptionReport');
        res.status(500).json({ error: 'Failed to generate consumption report' });
    }
};


module.exports = {
    getEnergyCosting,
    addEnergyCosting,
    updateEnergyCosting,
    deleteEnergyCosting,
    getEnergyTypes,
    getUnitTypes,
    getConsumptionReport
};
