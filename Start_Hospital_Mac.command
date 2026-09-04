#!/bin/bash
cd "$(dirname "$0")"

echo "======================================================================"
echo "  LLOYDS COMMUNITY CLINIC & PHARMACY SYSTEM (PAPUA NEW GUINEA)"
echo "  Mode: 100% Offline | Local SQLite Database Active"
echo "======================================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not found in PATH."
    exit 1
fi

echo "[1/2] Launching Local Hospital Server..."
node server/server.js &
SERVER_PID=$!

sleep 2

echo "[2/2] Opening Dashboard in default browser..."
open http://localhost:4000

echo ""
echo "System is running on PID $SERVER_PID. Press Ctrl+C to stop server."
wait $SERVER_PID
