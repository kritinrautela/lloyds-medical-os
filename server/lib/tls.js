const fs = require('fs');
const path = require('path');
const os = require('os');

const CERT_DIR = path.join(__dirname, '..', 'certs');
const KEY_FILE = path.join(CERT_DIR, 'clinic.key');
const CRT_FILE = path.join(CERT_DIR, 'clinic.crt');

/*
 * A certificate is not decoration here, it is what makes the tablets work.
 *
 * Android will only install this as an application — its own icon, full
 * screen, no browser bar — when the address it was opened from is https.
 * Over plain http on a clinic address like 10.130.41.244 the browser treats
 * the page as untrusted, refuses to register the offline worker, and offers
 * only a bookmark. So the clinic makes its own certificate once, and after
 * that the tablets get a real installed application.
 *
 * There is no certificate in the repository and none is generated
 * automatically: a private key that shipped with the software would be a
 * private key that everybody has, which is the same mistake as a shipped
 * password. Run: node server/scripts/make-certificate.js
 */
function readCertificate() {
  if (!fs.existsSync(KEY_FILE) || !fs.existsSync(CRT_FILE)) return null;
  try {
    return { key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CRT_FILE) };
  } catch (err) {
    console.warn(`  Certificate found but could not be read (${err.message}). Continuing without https.`);
    return null;
  }
}

// Every address this computer can be reached on from the clinic network. The
// certificate has to name them, because a browser rejects a certificate that
// does not mention the address actually typed in.
function localAddresses() {
  const found = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const entry of interfaces[name] || []) {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

module.exports = { readCertificate, localAddresses, CERT_DIR, KEY_FILE, CRT_FILE };
