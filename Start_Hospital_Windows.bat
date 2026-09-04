@echo off
TITLE Lloyds Hospital & Pharmacy Management System (PNG Edition)
COLOR 0B

echo ======================================================================
echo   LLOYDS COMMUNITY CLINIC & PHARMACY SYSTEM (PAPUA NEW GUINEA)
echo   Mode: 100% Offline | Portable Pen Drive Execution
echo ======================================================================
echo.
echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js once on this Windows laptop (or use portable Node).
    pause
    exit /b
)

echo [2/3] Starting Local Healthcare Server & SQLite Database Engine...
cd /d "%~dp0server"

start "Lloyds Hospital Server" /B node server.js

echo [3/3] Waiting for server initialization...
timeout /t 2 /nobreak >nul

echo Launching Hospital Dashboard in your default web browser...
start http://localhost:4000

echo.
echo ======================================================================
echo   SYSTEM IS ACTIVE & RUNNING!
echo   Local Address: http://localhost:4000
echo   To allow other laptops on clinic Wi-Fi/LAN to connect:
echo   Open Command Prompt, type 'ipconfig' and share your IP address.
echo ======================================================================
echo   Press any key to close this launcher window (Server will keep running).
pause >nul
