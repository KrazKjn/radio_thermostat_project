require('dotenv').config();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const db = require('../../db'); // Adjust path as needed
const Logger = require('../../components/Logger');
const { getEnergyUsage } = require('../controllers/energyController');

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
async function generateReport(thermostatId, timeFrame) {
    // This is a placeholder. In a real implementation, you would fetch and format data.
    // For now, we'll just reuse the energy usage logic as a stand-in.
    const req = { params: { ip: thermostatId } };
    const res = {
        json: (data) => data,
        status: (code) => ({
            json: (err) => ({ error: err, status: code }),
        }),
    };
    const reportData = await getEnergyUsage(req, res);

    return {
        subject: `${timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1)} Energy Report`,
        html: `<pre>${JSON.stringify(reportData, null, 2)}</pre>`, // Simple pre-formatted JSON for now
    };
}


// 3. Email Sending Function
async function sendReport(subscription) {
    try {
        const userSql = 'SELECT email, id FROM users WHERE id = ?';
        const user = await new Promise((resolve, reject) => {
            db.get(userSql, [subscription.user_id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!user) {
            Logger.error(`User not found for subscription ID: ${subscription.id}`, 'emailService', 'sendReport');
            return;
        }

        const thermostatSql = 'SELECT ip FROM thermostats WHERE id = ?';
        const thermostat = await new Promise((resolve, reject) => {
            db.get(thermostatSql, [subscription.thermostat_id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!thermostat) {
            Logger.error(`Thermostat not found for subscription ID: ${subscription.id}`, 'emailService', 'sendReport');
            return;
        }

        const report = await generateReport(thermostat.ip, subscription.report_type);

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
