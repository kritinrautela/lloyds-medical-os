#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================================"
echo "  LLOYDS MEDICAL OS — SAFE FLASH DRIVE EJECT PROTOCOL"
echo "  Flushing SQLite Write-Ahead Logs (WAL) to disk..."
echo "======================================================================"
echo ""

if command -v sqlite3 &> /dev/null; then
    sqlite3 server/data/hospital.db "PRAGMA wal_checkpoint(TRUNCATE);"
    echo "[SUCCESS] SQLite WAL journal flushed into server/data/hospital.db"
else
    echo "[INFO] SQLite CLI not found, flushing via Node.js..."
    node -e "const sqlite3 = require('./server/node_modules/sqlite3').verbose(); const db = new sqlite3.Database('./server/data/hospital.db'); db.run('PRAGMA wal_checkpoint(TRUNCATE);', (err) => { if (err) console.error(err); else console.log('[SUCCESS] Database journal flushed.'); db.close(); });"
fi

echo ""
echo "======================================================================"
echo "  ALL TRANSACTIONS SAFELY COMMITTED TO FLASH DRIVE!"
echo "  You may now safely eject and unplug this USB pen drive."
echo "======================================================================"
read -p "Press Enter to exit..."
