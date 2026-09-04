@echo off
TITLE Lloyds Medical OS (LMOS-PNG) — Clinical Command Center
COLOR 0B

echo ======================================================================
echo   LLOYDS MEDICAL OPERATING SYSTEM (LMOS-PNG)
echo   Occupational Health & Community Hospital Platform — Remote Concessions
echo   100% Offline-First | Local SQLite 3 WAL Database Active
echo ======================================================================
echo.

echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js once on this Windows laptop.
    pause
    exit /b
)

echo [2/3] Starting Local Healthcare Server & SQLite Database Engine...
cd /d "%~dp0server"

start "Lloyds Hospital Server" /B node server.js

echo [3/3] Waiting for server initialization...
timeout /t 2 /nobreak >nul

echo Launching Hospital Command Center in your default web browser...
start http://localhost:4000

echo.
echo ======================================================================
echo   SYSTEM IS ACTIVE AND READY FOR CLINIC STAFF!
echo ======================================================================
echo   Primary Laptop Address : http://localhost:4000
echo   To connect other laptops or tablets on clinic Wi-Fi:
echo   Open Command Prompt, type 'ipconfig', and navigate to:
echo   http://[YOUR-IP-ADDRESS]:4000
echo.
echo   DEFAULT CLINICAL LOGIN PASSWORDS:
echo     - Doctor / CMO      : doctor       / lloyds2026
echo     - Senior Nurse      : triage_officer / lloyds2026
echo     - Pharmacist        : pharmacist   / lloyds2026
echo     - Master Admin      : admin        / lloyds2026
echo     - Excel Unlock PIN  : lloyds2026
echo.
echo   DOCUMENTATION & MANUALS:
echo     - 20-Page Executive PDF : docs\Lloyds_Medical_OS_Executive_Manual.pdf
echo     - Quick Guide           : 00_START_HERE.txt
echo ======================================================================
echo   Keep this window open during clinic hours.
echo   When clinic closes, run 'Safe_Pen_Drive_Eject.bat' before unplugging USB.
echo ======================================================================
pause
