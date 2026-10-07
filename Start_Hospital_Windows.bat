@echo off
setlocal EnableExtensions
TITLE Lloyds Medical OS
COLOR 0B
cd /d "%~dp0"
set "DIR=%~dp0"
set "RUNTIME=%DIR%runtime"
set "PORT=4000"
:: Some Wi-Fi networks stall on IPv6 and the install then times out: use IPv4 only
set "NODE_OPTIONS=--dns-result-order=ipv4first --no-network-family-autoselection"

echo ======================================================================
echo   LLOYDS MEDICAL OS
echo   Lloyds Panguna Metals and Energy Limited
echo ======================================================================
echo.

:: Opened from inside the ZIP without extracting? Then the other files are missing.
if not exist "%DIR%server\server.js" (
    echo   [PROBLEM] This file is not inside the full Lloyds folder.
    echo.
    echo   If you downloaded a ZIP: close this window, right-click the ZIP file,
    echo   choose "Extract All...", then open the new folder and double-click again.
    goto :fail
)

:: Already running? Just open the browser.
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/health -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 (
    echo   The clinic system is already running. Opening it now...
    start "" http://localhost:%PORT%
    timeout /t 2 >nul
    exit /b 0
)

:: ---- Step 1: Node.js (the engine the clinic system runs on) ----
echo   [1/3] Checking the computer...
if exist "%RUNTIME%\node\node.exe" (
    set "PATH=%RUNTIME%\node;%PATH%"
) else (
    set "NEEDNODE=0"
    where node >nul 2>nul
    if errorlevel 1 set "NEEDNODE=1"
    if "%NEEDNODE%"=="0" node -e "process.exit(+process.versions.node.split('.')[0]>=20?0:1)" >nul 2>&1
    if errorlevel 1 set "NEEDNODE=1"
    if "%NEEDNODE%"=="1" call :getnode
    if errorlevel 1 goto :fail
)

:: ---- Step 2: the clinic program's parts (first run only) ----
node -e "require('./server/node_modules/express');require('./server/node_modules/sqlite3')" >nul 2>&1
if errorlevel 1 (
    echo   [2/3] Installing the clinic program ^(one time only, please wait^)...
    if exist "%DIR%server\node_modules" rmdir /s /q "%DIR%server\node_modules"
    call npm --prefix server install --omit=dev --no-audit --no-fund --loglevel=error --fetch-retries=5 --fetch-retry-mintimeout=2000
    if errorlevel 1 (
        echo   [PROBLEM] Install did not finish. Check the internet and double-click again.
        goto :fail
    )
) else (
    echo   [2/3] Clinic program is ready.
)
if not exist "%DIR%client\dist\index.html" (
    echo         Building the screens ^(one time only^)...
    call npm --prefix client install --no-audit --no-fund --loglevel=error --fetch-retries=5 --fetch-retry-mintimeout=2000
    call npm --prefix client run build
    if errorlevel 1 (
        echo   [PROBLEM] Could not build the screens. Check the internet and try again.
        goto :fail
    )
)

:: ---- Desktop shortcut with the Lloyds icon ----
powershell -NoProfile -Command "$d=[Environment]::GetFolderPath('Desktop')+'\Lloyds Medical OS.lnk'; if (-not (Test-Path $d)) { $s=(New-Object -COM WScript.Shell).CreateShortcut($d); $s.TargetPath='%DIR%Start_Hospital_Windows.bat'; $s.WorkingDirectory='%DIR%'; $s.Save() }" >nul 2>&1

:: ---- Step 3: start ----
echo   [3/3] Starting the clinic system...
start "Lloyds Clinic Server - keep this window open" /MIN /D "%DIR%server" node server.js

set /a tries=0
:wait
powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:%PORT%/api/health -TimeoutSec 2).StatusCode } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto :ready
set /a tries+=1
if %tries% geq 30 (
    echo   [PROBLEM] The clinic system did not start. Take a photo of this window and send it to support.
    goto :fail
)
timeout /t 1 >nul
goto :wait

:ready
start "" http://localhost:%PORT%
echo.
echo ======================================================================
echo   READY. The clinic system is open in your browser.
echo.
echo   This computer      :  http://localhost:%PORT%
echo   Tablets / laptops  :  see the address on the "Lloyds Clinic Server" window
echo                         ^(same Wi-Fi^)
echo.
echo   The system keeps running in the small "Lloyds Clinic Server" window
echo   on the taskbar. Do not close that window while the clinic is working.
echo ======================================================================
echo.
pause
exit /b 0

:getnode
echo         Setting up the engine ^(one time only, please wait^)...
if not exist "%RUNTIME%" mkdir "%RUNTIME%"
set "NODEARCH=win-x64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODEARCH=win-arm64"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;" ^
  "$base='https://nodejs.org/dist/latest-v22.x/'; $sums=(Invoke-WebRequest -UseBasicParsing ($base+'SHASUMS256.txt')).Content -split '\r?\n';" ^
  "$line=$sums | Where-Object { $_ -match '%NODEARCH%\.zip' } | Select-Object -First 1; $hash,$file=($line.Trim() -split '\s+');" ^
  "$zip=Join-Path '%RUNTIME%' $file; (New-Object Net.WebClient).DownloadFile($base+$file,$zip);" ^
  "if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $hash.ToUpper()) { throw 'damaged download' };" ^
  "Expand-Archive -Force $zip '%RUNTIME%'; Rename-Item (Join-Path '%RUNTIME%' ($file -replace '\.zip$','')) 'node'; Remove-Item $zip"
if errorlevel 1 (
    echo   [PROBLEM] Could not set up the engine. Check the internet and double-click again.
    exit /b 1
)
set "PATH=%RUNTIME%\node;%PATH%"
exit /b 0

:fail
echo.
echo   Press any key to close this window.
pause >nul
exit /b 1
