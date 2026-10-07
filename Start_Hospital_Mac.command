#!/bin/bash
# Lloyds Medical OS - one double-click start for Mac.
# First run: downloads everything it needs by itself (about 2 minutes, needs internet once).
# Every run after that: starts in a few seconds, no internet needed.

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1
PORT=4000
RUNTIME="$DIR/runtime"
# Some Wi-Fi networks stall on IPv6 and the install then times out: use IPv4 only
export NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
NODE_MAJOR=22

pause_and_exit() {
    echo ""
    echo "  Press Enter to close this window."
    read -r _
    exit "${1:-1}"
}

clear
echo "======================================================================"
echo "  LLOYDS MEDICAL OS"
echo "  Lloyds Panguna Metals and Energy Limited"
echo "======================================================================"
echo ""

# Make sure the helper files are allowed to run (a ZIP download can drop this)
chmod +x "$DIR"/*.command 2>/dev/null
# Remove the "downloaded from the internet" lock so Mac stops asking again
xattr -dr com.apple.quarantine "$DIR" 2>/dev/null

if [ ! -f "$DIR/server/server.js" ]; then
    echo "  [PROBLEM] This file is not inside the full Lloyds folder."
    echo "  Please move the WHOLE folder to your Desktop, then double-click again."
    pause_and_exit 1
fi

# Already running? Just open the browser.
if curl -s -o /dev/null "http://localhost:$PORT/api/health"; then
    echo "  The clinic system is already running. Opening it now..."
    open "http://localhost:$PORT"
    sleep 2
    exit 0
fi

# ---- Step 1: Node.js (the engine the clinic system runs on) ----
echo "  [1/3] Checking the computer..."
if [ -x "$RUNTIME/node/bin/node" ]; then
    export PATH="$RUNTIME/node/bin:$PATH"
elif ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)" -lt 20 ] 2>/dev/null; then
    echo "        Setting up the engine (one time only, please wait)..."
    case "$(uname -m)" in
        arm64) PLATFORM="darwin-arm64" ;;
        *)     PLATFORM="darwin-x64" ;;
    esac
    SUMS=$(curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt") || {
        echo "  [PROBLEM] No internet connection. Connect to the internet once and try again."
        pause_and_exit 1
    }
    FILE=$(echo "$SUMS" | awk -v p="$PLATFORM.tar.gz" '$2 ~ p {print $2; exit}')
    WANT=$(echo "$SUMS" | awk -v f="$FILE" '$2 == f {print $1}')
    mkdir -p "$RUNTIME"
    if ! curl -fL --progress-bar "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$FILE" -o "$RUNTIME/$FILE"; then
        echo "  [PROBLEM] The download did not finish. Check the internet and try again."
        pause_and_exit 1
    fi
    GOT=$(shasum -a 256 "$RUNTIME/$FILE" | awk '{print $1}')
    if [ "$GOT" != "$WANT" ]; then
        echo "  [PROBLEM] The download was damaged. Please try again."
        mv "$RUNTIME/$FILE" "$RUNTIME/$FILE.bad" 2>/dev/null
        pause_and_exit 1
    fi
    tar -xzf "$RUNTIME/$FILE" -C "$RUNTIME" && mv "$RUNTIME/${FILE%.tar.gz}" "$RUNTIME/node"
    mv "$RUNTIME/$FILE" "$RUNTIME/$FILE.done" 2>/dev/null
    export PATH="$RUNTIME/node/bin:$PATH"
fi

# ---- Step 2: the clinic program's parts (first run only) ----
if ! node -e "require('./server/node_modules/express');require('./server/node_modules/sqlite3')" >/dev/null 2>&1; then
    echo "  [2/3] Installing the clinic program (one time only, please wait)..."
    # A half-finished earlier install can leave broken parts behind: start clean
    [ -d "$DIR/server/node_modules" ] && rm -rf "$DIR/server/node_modules"
    if ! npm --prefix server install --omit=dev --no-audit --no-fund --loglevel=error --fetch-retries=5 --fetch-retry-mintimeout=2000; then
        echo "  [PROBLEM] Install did not finish. Check the internet and double-click again."
        pause_and_exit 1
    fi
else
    echo "  [2/3] Clinic program is ready."
fi
if [ ! -f "$DIR/client/dist/index.html" ]; then
    echo "        Building the screens (one time only)..."
    npm --prefix client install --no-audit --no-fund --loglevel=error --fetch-retries=5 --fetch-retry-mintimeout=2000 && npm --prefix client run build || {
        echo "  [PROBLEM] Could not build the screens. Check the internet and try again."
        pause_and_exit 1
    }
fi

# ---- Desktop shortcut so next time it is one click from the Desktop ----
SHORTCUT="$HOME/Desktop/Lloyds Medical OS.command"
if [ ! -e "$SHORTCUT" ] && [ -d "$HOME/Desktop" ]; then
    printf '#!/bin/bash\nexec "%s/Start_Hospital_Mac.command"\n' "$DIR" > "$SHORTCUT"
    chmod +x "$SHORTCUT" 2>/dev/null
fi

# ---- Step 3: start ----
echo "  [3/3] Starting the clinic system..."
node server/server.js &
SERVER_PID=$!

for _ in $(seq 1 40); do
    curl -s -o /dev/null "http://localhost:$PORT/api/health" && break
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo ""
        echo "  [PROBLEM] The clinic system stopped. Take a photo of this window and send it to support."
        pause_and_exit 1
    fi
    sleep 0.5
done

open "http://localhost:$PORT"
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

echo ""
echo "======================================================================"
echo "  READY. The clinic system is open in your browser."
echo ""
echo "  This computer      :  http://localhost:$PORT"
[ -n "$LOCAL_IP" ] && echo "  Tablets / laptops  :  http://$LOCAL_IP:$PORT   (same Wi-Fi)"
echo ""
echo "  KEEP THIS WINDOW OPEN while the clinic is working."
echo "  To stop: close this window."
echo "======================================================================"
wait "$SERVER_PID"
