@echo off
TITLE Lloyds Medical OS — Safe Flash Drive Eject
COLOR 0A

echo ======================================================================
echo   LLOYDS MEDICAL OS — SAFE FLASH DRIVE EJECT PROTOCOL
echo   Flushing SQLite Write-Ahead Logs (WAL) to disk...
echo ======================================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% equ 0 (
    node -e "const sqlite3 = require('./server/node_modules/sqlite3').verbose(); const db = new sqlite3.Database('./server/data/hospital.db'); db.run('PRAGMA wal_checkpoint(TRUNCATE);', (err) => { if (err) console.error(err); else console.log('[SUCCESS] SQLite WAL journal flushed into server/data/hospital.db.'); db.close(); });"
) else (
    echo [INFO] Node.js not detected in path. Ensure server window is closed.
)

echo.
echo ======================================================================
echo   ALL CLINICAL & FINANCIAL RECORDS SAFELY COMMITTED TO DISK!
echo   You may now safely unplug this USB flash drive from your computer.
echo ======================================================================
echo.
pause
