@echo off
TITLE Lloyds Medical OS (LMOS-PNG) — Clinical Command Center
COLOR 0B

echo ======================================================================
echo   LLOYDS MEDICAL OPERATING SYSTEM (LMOS-PNG)
echo   Occupational Health & Community Hospital Platform — Remote Concessions
echo   100% Offline-First | Local SQLite 3 WAL Database Active
echo ======================================================================
echo.

:: 1. CHECK & AUTO-INSTALL NODE.JS IF MISSING
echo [1/4] Checking system environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [SETUP] Node.js was not found on this computer.
    echo [SETUP] Automatically downloading and installing Node.js runtime...
    
    where winget >nul 2>nul
    if %errorlevel% equ 0 (
        echo [SETUP] Installing via Windows Package Manager (winget)...
        winget install OpenJS.NodeJS.LTS -e --silent --accept-source-agreements --accept-package-agreements
    ) else (
        echo [SETUP] Downloading official Node.js installer from nodejs.org...
        powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://nodejs.org/dist/v20.17.0/node-v20.17.0-x64.msi', '%temp%\node_setup.msi')"
        echo [SETUP] Installing Node.js in background...
        msiexec /i "%temp%\node_setup.msi" /quiet /norestart
        del "%temp%\node_setup.msi" 2>nul
    )
    
    set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"
)

:: 2. AUTO-INSTALL PROJECT PACKAGES ON FIRST RUN
if not exist "%~dp0server\node_modules" (
    echo.
    echo [2/4] First-time run detected. Installing hospital application packages...
    cd /d "%~dp0"
    call npm run setup
)

:: 3. AUTO-BUILD FRONTEND IF NEEDED
if not exist "%~dp0client\dist" (
    echo.
    echo [SETUP] Building production clinical dashboard...
    cd /d "%~dp0"
    call npm run build
)

:: 4. AUTO-CREATE DESKTOP SHORTCUT FOR 1-CLICK ACCESS
powershell -Command "$desk=[Environment]::GetFolderPath('Desktop')+'\Lloyds Medical OS.lnk'; if (-not (Test-Path $desk)) { $s=(New-Object -COM WScript.Shell).CreateShortcut($desk); $s.TargetPath='%~dp0Start_Hospital_Windows.bat'; $s.WorkingDirectory='%~dp0'; $s.Save(); }" >nul 2>&1

echo.
echo [3/4] Starting Local Healthcare Server & SQLite Database Engine...
cd /d "%~dp0server"

start "Lloyds Hospital Server" /B node server.js

echo.
echo [4/4] Initializing database journals and launching browser...
timeout /t 2 /nobreak >nul

start http://localhost:4000

echo.
echo ======================================================================
echo   SYSTEM IS ACTIVE AND READY FOR CLINIC STAFF!
echo ======================================================================
echo   Primary Laptop Address : http://localhost:4000
echo.
echo   To connect other laptops or tablets on clinic Wi-Fi (No Internet):
echo   Open Command Prompt, type 'ipconfig', and navigate to:
echo   http://[YOUR-IP-ADDRESS]:4000
echo.
echo   DEFAULT CLINICAL LOGIN PASSWORDS:
echo     - Doctor / CMO      : doctor         / lloyds2026
echo     - Senior Nurse      : triage_officer   / lloyds2026
echo     - Pharmacist        : pharmacist     / lloyds2026
echo     - Master Admin      : admin          / lloyds2026
echo     - Excel Unlock PIN  : lloyds2026
echo.
echo   NOTE: A shortcut named 'Lloyds Medical OS' has been placed on your
echo   Desktop so you can launch it with 1 click anytime!
echo ======================================================================
echo   Keep this window open during clinic hours.
echo   When clinic closes, run 'Safe_Pen_Drive_Eject.bat' before unplugging USB.
echo ======================================================================
pause
