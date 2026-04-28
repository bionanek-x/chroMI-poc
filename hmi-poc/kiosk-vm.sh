#!/usr/bin/env bash
# Launch Chromium in kiosk mode for a VM (no GPU passthrough).
# Uses SwiftShader (CPU-based WebGL) — FPS numbers reflect CPU perf, not GPU.
# Run ./serve.sh first, then open a second terminal and run this script.
#
# Usage: ./kiosk-vm.sh [url] [display]
#   url     defaults to http://localhost:8080
#   display defaults to :0

set -euo pipefail

URL="${1:-http://localhost:8080}"
DISPLAY_NUM="${2:-:0}"
PROFILE_DIR="/tmp/hmi-poc-chrome-profile"

# Locate the browser binary
CHROMIUM_BIN=""
for candidate in \
    chromium-browser \
    chromium \
    google-chrome \
    google-chrome-stable \
    /usr/bin/chromium-browser \
    /usr/bin/chromium \
    /usr/bin/google-chrome \
    /usr/bin/google-chrome-stable \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if command -v "$candidate" &>/dev/null || [[ -x "$candidate" ]]; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: Chromium / Google Chrome not found. Install it first." >&2
  exit 1
fi

echo "Launching $CHROMIUM_BIN → $URL"

DISPLAY="$DISPLAY_NUM" "$CHROMIUM_BIN" \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions \
  --disable-translate \
  --disable-features=TranslateUI \
  --use-gl=angle \
  --use-angle=swiftshader \
  --enable-webgl \
  --webgl-msaa-sample-count=0 \
  --disable-gpu-driver-bug-workarounds \
  --ignore-gpu-blocklist \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --touch-events=enabled \
  --user-data-dir="$PROFILE_DIR" \
  "$URL"
