#!/bin/bash
cd "$(dirname "$0")"

clear
echo "======================================================================"
echo "  LLOYDS MEDICAL OPERATING SYSTEM (LMOS-PNG)"
echo "  Occupational Health & Community Hospital Platform — Remote Concessions"
echo "  100% Offline-First | Local SQLite 3 WAL Database Active"
echo "======================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not found in PATH."
    echo "Please download and install Node.js from https://nodejs.org"
    read -p "Press Enter to exit..."
    exit 1
fi

if [ ! -d "server/node_modules" ]; then
    echo "[SETUP] First-time run detected. Installing dependencies automatically..."
    npm run setup
fi

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
echo "    - Doctor / CMO      : doctor       / lloyds2026"
echo "    - Senior Nurse      : triage_officer / lloyds2026"
echo "    - Pharmacist        : pharmacist   / lloyds2026"
echo "    - Master Admin      : admin        / lloyds2026"
echo "    - Excel Unlock PIN  : lloyds2026"
echo ""
echo "  DOCUMENTATION & MANUALS:"
echo "    - 20-Page Executive PDF : docs/Lloyds_Medical_OS_Executive_Manual.pdf"
echo "    - Quick Guide           : 00_START_HERE.txt"
echo "======================================================================"
echo "  Running on PID $SERVER_PID. Keep this window open during clinic hours."
echo "  Press Ctrl+C to stop server."
echo "======================================================================"
wait $SERVER_PID
