#!/usr/bin/env node
/*
 * Makes the clinic's own certificate, once, on the clinic's own computer.
 *
 * Why this exists: Android only installs a web address as a real application
 * — its own icon, full screen, works when the Wi-Fi drops — if the address
 * starts with https. This produces the certificate that allows that, naming
 * every address this computer answers on so the tablets accept it.
 *
 * The key it writes never leaves this computer and is not in the repository.
 * Run it again whenever the clinic computer's network address changes.
 *
 *   node server/scripts/make-certificate.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { localAddresses, CERT_DIR, KEY_FILE, CRT_FILE } = require('../lib/tls');

const YEARS = 10;

function openSslAvailable() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

if (!openSslAvailable()) {
  console.error('\n  openssl is not installed on this computer, so the certificate cannot be made here.');
  console.error('  On Windows it comes with Git for Windows. On macOS and Linux it is already present.\n');
  process.exit(1);
}

const addresses = localAddresses();
if (!addresses.length) {
  console.error('\n  This computer is not on a network, so there is no clinic address to put in the certificate.');
  console.error('  Connect it to the clinic Wi-Fi or cable first, then run this again.\n');
  process.exit(1);
}

fs.mkdirSync(CERT_DIR, { recursive: true });

// The browser checks this list, not the certificate's name. Every address a
// member of staff might type has to appear here or the tablet will refuse.
const names = ['DNS:localhost', 'IP:127.0.0.1', ...addresses.map((ip) => `IP:${ip}`)];

const configPath = path.join(CERT_DIR, 'openssl.cnf');
fs.writeFileSync(configPath, `[req]
distinguished_name = dn
x509_extensions = ext
prompt = no

[dn]
CN = Lloyds Clinic
O = Lloyds Metals and Energy
OU = Community Hospital and Occupational Health Centre
C = PG

[ext]
subjectAltName = ${names.join(',')}
basicConstraints = critical, CA:TRUE
keyUsage = critical, digitalSignature, keyCertSign
extendedKeyUsage = serverAuth
`);

execFileSync('openssl', [
  'req', '-x509', '-nodes', '-newkey', 'rsa:2048',
  '-keyout', KEY_FILE,
  '-out', CRT_FILE,
  '-days', String(YEARS * 365),
  '-config', configPath
], { stdio: ['ignore', 'ignore', 'pipe'] });

fs.chmodSync(KEY_FILE, 0o600);
fs.rmSync(configPath);

console.log(`
  ==============================================================
   The clinic certificate has been made.
  ==============================================================
   Valid for              : ${YEARS} years
   Good for these addresses:
     ${['localhost', '127.0.0.1', ...addresses].join('\n     ')}

   Start the system again. It will now also answer on https, and
   the address printed there is the one to open on a tablet.

   On each Android tablet, once:
     1. Copy server/certs/clinic.crt onto the tablet.
     2. Settings, search "certificate", choose "CA certificate",
        pick the file, accept the warning.
     3. Open the https clinic address in Chrome.
     4. Chrome menu, "Install app" or "Add to home screen".

   Keep server/certs/clinic.key on this computer only. Anybody
   holding it can pretend to be the clinic server.
  ==============================================================
`);
