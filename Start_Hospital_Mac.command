#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

clear
echo "======================================================================"
echo "  LLOYDS MEDICAL OPERATING SYSTEM (LMOS-PNG)"
echo "  Occupational Health & Community Hospital Platform — Remote Concessions"
echo "  100% Offline-First | Local SQLite 3 WAL Database Active"
echo "======================================================================"
echo ""

# 1. AUTO-CHECK & INSTALL NODE.JS IF MISSING
if ! command -v node &> /dev/null; then
    echo "[SETUP] Node.js runtime not found on this Mac."
    echo "[SETUP] Automatically installing Node.js runtime..."
    
    if command -v brew &> /dev/null; then
        echo "Installing Node.js via Homebrew..."
        brew install node
    else
        echo "Downloading official Node.js installer from nodejs.org..."
        curl -sL "https://nodejs.org/dist/v20.17.0/node-v20.17.0.pkg" -o "/tmp/node_installer.pkg"
        echo "Installing Node.js... (Enter your Mac password if prompted)"
        sudo installer -pkg "/tmp/node_installer.pkg" -target /
        rm -f "/tmp/node_installer.pkg"
    fi
fi

# 2. AUTO-INSTALL PROJECT DEPENDENCIES ON FIRST RUN
if [ ! -d "server/node_modules" ]; then
    echo ""
    echo "[SETUP] First-time run detected. Installing hospital application packages..."
    npm run setup
fi

# 3. AUTO-BUILD FRONTEND IF NEEDED
if [ ! -d "client/dist" ]; then
    echo ""
    echo "[SETUP] Building production clinical dashboard..."
    npm run build
fi

# 4. AUTO-CREATE DESKTOP SHORTCUT
if [ ! -f "$HOME/Desktop/Lloyds Medical OS.command" ]; then
    ln -sf "$DIR/Start_Hospital_Mac.command" "$HOME/Desktop/Lloyds Medical OS.command"
    chmod +x "$HOME/Desktop/Lloyds Medical OS.command" 2>/dev/null
fi

echo ""
echo "[1/2] Initializing Lloyds Hospital Server & SQLite Database..."
node server/server.js &
SERVER_PID=$!

sleep 2

echo "[2/2] Launching Hospital Command Center in default browser..."
open http://localhost:4000

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

echo ""
echo "======================================================================"
echo "  SYSTEM IS ACTIVE AND READY FOR CLINIC STAFF!"
echo "======================================================================"
echo "  Primary Laptop Address : http://localhost:4000"
if [ "$LOCAL_IP" != "localhost" ]; then
echo "  Clinic Wi-Fi / Tablets : http://$LOCAL_IP:4000"
fi
echo ""
echo "  DEFAULT CLINICAL LOGIN PASSWORDS:"
echo "    - Doctor / CMO      : doctor         / lloyds2026"
echo "    - Senior Nurse      : triage_officer   / lloyds2026"
echo "    - Pharmacist        : pharmacist     / lloyds2026"
echo "    - Master Admin      : admin          / lloyds2026"
echo "    - Excel Unlock PIN  : lloyds2026"
echo ""
echo "  NOTE: A shortcut named 'Lloyds Medical OS' has been placed on your"
echo "  Desktop so you can launch it with 1 click anytime!"
echo "======================================================================"
echo "  Running on PID $SERVER_PID. Keep this window open during clinic hours."
echo "  Press Ctrl+C to stop server."
echo "======================================================================"
wait $SERVER_PID
