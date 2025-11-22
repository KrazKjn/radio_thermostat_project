require('dotenv').config();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const db = require('../../db'); // Adjust path as needed
const Logger = require('../../components/Logger');

// 1. Nodemailer Transport Configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// 2. Report Generation Logic
async function getReportData(thermostatId, timeFrame) {
    return new Promise((resolve, reject) => {
        let startTime;
        const now = new Date();
        if (timeFrame === 'daily') {
            startTime = new Date(now.setDate(now.getDate() - 1));
        } else if (timeFrame === 'weekly') {
            startTime = new Date(now.setDate(now.getDate() - 7));
        } else if (timeFrame === 'monthly') {
            startTime = new Date(now.setMonth(now.getMonth() - 1));
        } else {
            return reject(new Error('Invalid time frame specified'));
        }

        const startTimeMs = startTime.getTime();

        const sql = `
            SELECT
                t.location,
                COALESCE(SUM(CASE WHEN tc.tmode = 1 THEN tc.run_time ELSE 0 END), 0) as heating_runtime,
                COALESCE(SUM(CASE WHEN tc.tmode = 2 THEN tc.run_time ELSE 0 END), 0) as cooling_runtime,
                COUNT(tc.id) as total_cycles,
                AVG(sd.temp) as avg_indoor_temp,
                AVG(sd.outdoor_temp) as avg_outdoor_temp
            FROM thermostats t
            LEFT JOIN tstate_cycles tc ON t.id = tc.thermostat_id AND tc.start_timestamp >= ?
            LEFT JOIN scan_data sd ON t.id = sd.thermostat_id AND sd.timestamp >= ?
            WHERE t.id = ?
            GROUP BY t.id;
        `;

        db.get(sql, [startTimeMs, startTimeMs, thermostatId], (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row);
        });
    });
}


async function generateDailyReport(thermostatId) {
    const data = await getReportData(thermostatId, 'daily');
    if (!data) return { subject: 'Daily Report', html: '<p>No data available for the last 24 hours.</p>' };

    const html = `
        <h1>Daily HVAC Report for ${data.location}</h1>
        <p>Here is your summary for the last 24 hours:</p>
        <ul>
            <li><strong>Heating Runtime:</strong> ${data.heating_runtime.toFixed(2)} minutes</li>
            <li><strong>Cooling Runtime:</strong> ${data.cooling_runtime.toFixed(2)} minutes</li>
            <li><strong>Total Cycles:</strong> ${data.total_cycles}</li>
            <li><strong>Average Indoor Temperature:</strong> ${data.avg_indoor_temp ? data.avg_indoor_temp.toFixed(2) : 'N/A'}°F</li>
            <li><strong>Average Outdoor Temperature:</strong> ${data.avg_outdoor_temp ? data.avg_outdoor_temp.toFixed(2) : 'N/A'}°F</li>
        </ul>
    `;
    return { subject: `Daily Report - ${data.location}`, html };
}

async function generateWeeklyReport(thermostatId) {
    const data = await getReportData(thermostatId, 'weekly');
    if (!data) return { subject: 'Weekly Report', html: '<p>No data available for the last 7 days.</p>' };

    const html = `
        <h1>Weekly HVAC Report for ${data.location}</h1>
        <p>Here is your summary for the last 7 days:</p>
        <ul>
            <li><strong>Heating Runtime:</strong> ${(data.heating_runtime / 60).toFixed(2)} hours</li>
            <li><strong>Cooling Runtime:</strong> ${(data.cooling_runtime / 60).toFixed(2)} hours</li>
            <li><strong>Total Cycles:</strong> ${data.total_cycles}</li>
            <li><strong>Average Indoor Temperature:</strong> ${data.avg_indoor_temp ? data.avg_indoor_temp.toFixed(2) : 'N/A'}°F</li>
            <li><strong>Average Outdoor Temperature:</strong> ${data.avg_outdoor_temp ? data.avg_outdoor_temp.toFixed(2) : 'N/A'}°F</li>
        </ul>
    `;
    return { subject: `Weekly Report - ${data.location}`, html };
}

async function generateMonthlyReport(thermostatId) {
    const data = await getReportData(thermostatId, 'monthly');
    if (!data) return { subject: 'Monthly Report', html: '<p>No data available for the last month.</p>' };

    const html = `
        <h1>Monthly HVAC Report for ${data.location}</h1>
        <p>Here is your summary for the last month:</p>
        <ul>
            <li><strong>Heating Runtime:</strong> ${(data.heating_runtime / 60).toFixed(2)} hours</li>
            <li><strong>Cooling Runtime:</strong> ${(data.cooling_runtime / 60).toFixed(2)} hours</li>
            <li><strong>Total Cycles:</strong> ${data.total_cycles}</li>
            <li><strong>Average Indoor Temperature:</strong> ${data.avg_indoor_temp ? data.avg_indoor_temp.toFixed(2) : 'N/A'}°F</li>
            <li><strong>Average Outdoor Temperature:</strong> ${data.avg_outdoor_temp ? data.avg_outdoor_temp.toFixed(2) : 'N/A'}°F</li>
        </ul>
    `;
    return { subject: `Monthly Report - ${data.location}`, html };
}


// 3. Email Sending Function
async function sendReport(subscription) {
    try {
        const userSql = 'SELECT email FROM users WHERE id = ?';
        const user = await new Promise((resolve, reject) => {
            db.get(userSql, [subscription.user_id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            Logger.error(`User not found for subscription ID: ${subscription.id}`, 'emailService', 'sendReport');
            return;
        }

        let report;
        switch (subscription.report_type) {
            case 'daily':
                report = await generateDailyReport(subscription.thermostat_id);
                break;
            case 'weekly':
                report = await generateWeeklyReport(subscription.thermostat_id);
                break;
            case 'monthly':
                report = await generateMonthlyReport(subscription.thermostat_id);
                break;
            default:
                Logger.warn(`Unknown report type: ${subscription.report_type}`, 'emailService', 'sendReport');
                return;
        }

        const mailOptions = {
            from: `"HVAC Monitor" <${process.env.EMAIL_FROM_ADDRESS}>`,
            to: user.email,
            subject: report.subject,
            html: report.html,
        };

        await transporter.sendMail(mailOptions);
        Logger.info(`Report '${subscription.report_type}' sent to ${user.email} for thermostat ${subscription.thermostat_id}`, 'emailService', 'sendReport');

    } catch (error) {
        Logger.error(`Failed to send report for subscription ID ${subscription.id}: ${error.message}`, 'emailService', 'sendReport');
    }
}


// 4. Job Scheduling Logic
function scheduleJobs() {
    Logger.info('Setting up cron jobs for email reports...', 'emailService', 'scheduleJobs');

    // Schedule daily reports (e.g., every day at 7 AM)
    cron.schedule('0 7 * * *', async () => {
        Logger.info('Running daily report job...', 'emailService', 'cron');
        const sql = "SELECT * FROM report_subscriptions WHERE report_type = 'daily' AND is_active = 1";
        db.all(sql, [], (err, subscriptions) => {
            if (err) {
                Logger.error(`Error fetching daily subscriptions: ${err.message}`, 'emailService', 'cron');
                return;
            }
            subscriptions.forEach(sendReport);
        });
    });

    // Schedule weekly reports (e.g., every Monday at 7 AM)
    cron.schedule('0 7 * * 1', async () => {
        Logger.info('Running weekly report job...', 'emailService', 'cron');
        const sql = "SELECT * FROM report_subscriptions WHERE report_type = 'weekly' AND is_active = 1";
        db.all(sql, [], (err, subscriptions) => {
            if (err) {
                Logger.error(`Error fetching weekly subscriptions: ${err.message}`, 'emailService', 'cron');
                return;
            }
            subscriptions.forEach(sendReport);
        });
    });

    // Schedule monthly reports (e.g., on the 1st of every month at 7 AM)
    cron.schedule('0 7 1 * *', async () => {
        Logger.info('Running monthly report job...', 'emailService', 'cron');
        const sql = "SELECT * FROM report_subscriptions WHERE report_type = 'monthly' AND is_active = 1";
        db.all(sql, [], (err, subscriptions) => {
            if (err) {
                Logger.error(`Error fetching monthly subscriptions: ${err.message}`, 'emailService', 'cron');
                return;
            }
            subscriptions.forEach(sendReport);
        });
    });

    Logger.info('Cron jobs scheduled.', 'emailService', 'scheduleJobs');
}

module.exports = { scheduleJobs };
