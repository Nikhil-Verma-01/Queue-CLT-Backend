// errorHandler.js
const fs = require('fs');
const path = require('path');
const cfg = require('./config.json');

const logFile = path.join(__dirname, 'queuectl_errors.log');

function handleError(context, err) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    context,
    message: err && err.message ? err.message : String(err),
    stack: err && err.stack ? err.stack : null
  };
  try {
    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  // eslint-disable-next-line no-unused-vars
  } catch (e) {
    // nothing - logging shouldn't crash the app
  }
  const normalized = new Error(`[${context}] ${entry.message}`);
  normalized.meta = entry;
  return normalized;
}

module.exports = { handleError, logFile };
