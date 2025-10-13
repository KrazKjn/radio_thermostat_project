const { json } = require('body-parser');

let fs, path, LOG_FILE_PATH;
let fileLoggingEnabled = false;

try {
  fs = require('fs');
  path = require('path');
  if (typeof __dirname !== 'undefined') {
    LOG_FILE_PATH = process.env.LOG_FILE_PATH || path.join(__dirname, 'app.log');
    fileLoggingEnabled = true;
  }
} catch (err) {
  console.warn('File logging disabled: fs or __dirname not available');
}
const LOG_MODE = process.env.LOG_MODE || 'screen'; // 'screen', 'file', or 'both'
const LOG_DEBUG_LEVEL = process.env.LOG_DEBUG_LEVEL || 4; // 0=general, >= 1 => Depening level of debug verbosity

const levels = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG'
};

const colors = {
  info: '\x1b[36m',   // cyan
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  debug: '\x1b[35m',  // magenta
  reset: '\x1b[0m',
  json: '\x1b[32m'   // green
};

function formatMessage(level, message, moduleName, functionName) {
  const timestamp = new Date().toLocaleString();
  const context = [moduleName, functionName].filter(Boolean).join('.');
  return `[${timestamp}] [${levels[level]}]${context ? ' [' + context + ']' : ''} ${message}`;
}

function writeToFile(formatted) {
  if (!fileLoggingEnabled) return;
  fs.appendFile(LOG_FILE_PATH, formatted.replace(/\x1b\[\d+m/g, '') + '\n', err => {
    if (err) console.error('Logger file write failed:', err.message);
  });
}

function log(level, message, moduleName = '', functionName = '', debug_level = 0) {
  if (level === 'debug' && debug_level > LOG_DEBUG_LEVEL) return; // Skip debug messages above the set level
  const formatted = formatMessage(level, message, moduleName, functionName);
  const color = colors[level] || colors.reset;
  const output = `${color}${formatted}${colors.reset}`;

  if (LOG_MODE === 'screen' || LOG_MODE === 'both') {
    console.log(output);
  }
  if ((LOG_MODE === 'file' || LOG_MODE === 'both') && fileLoggingEnabled) {
    writeToFile(formatted);
  }
  if (level === 'error') {
    // Optionally, could also log to stderr or send alerts
    console.error(formatted);
  }
  return formatted;
}

function formatJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  const output = `${colors.json}${json}${colors.reset}`;
  return output;
}

module.exports = {
  info: (msg, mod, fn) => log('info', msg, mod, fn),
  warn: (msg, mod, fn) => log('warn', msg, mod, fn),
  error: (msg, mod, fn) => log('error', msg, mod, fn),
  debug: (msg, mod, fn, debug_level = 0) => log('debug', msg, mod, fn, debug_level),
  formatJSON: (obj) => formatJSON(obj)
};
