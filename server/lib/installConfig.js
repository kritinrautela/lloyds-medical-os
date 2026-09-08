const fs = require('fs');
const path = require('path');

/*
 * What Lloyds sets at installation, so the clinic never has to.
 *
 * A JSON file beside the server holds the company's Google OAuth client and,
 * where head office runs a receiver, its address and key. Staff at the clinic
 * never see these values and never type them; the page they see has one
 * button. Environment variables override the file, which suits a service
 * manager. The file is listed in .gitignore and is never committed.
 *
 * The file is re-read at most every half minute, so an edit is picked up
 * without restarting the server.
 */

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'install.json');

let cache = { at: 0, value: {} };

function readFile() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error(`The install file ${CONFIG_FILE} could not be read: ${err.message}`);
    return {};
  }
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function installConfig() {
  if (Date.now() - cache.at > 30 * 1000) {
    cache = { at: Date.now(), value: readFile() };
  }
  const file = cache.value;
  const env = process.env;
  return {
    clinic_id: text(env.LLOYDS_CLINIC_ID || file.clinic_id),
    google_client_id: text(env.GOOGLE_CLIENT_ID || file.google_client_id),
    google_client_secret: text(env.GOOGLE_CLIENT_SECRET || file.google_client_secret),
    offsite_url: text(env.LLOYDS_OFFSITE_URL || file.offsite_url),
    offsite_key: text(env.LLOYDS_OFFSITE_KEY || file.offsite_key)
  };
}

module.exports = { installConfig, CONFIG_FILE };
