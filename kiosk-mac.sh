#!/usr/bin/env bash
# Launch Chromium / Chrome in kiosk mode on macOS.
# Run ./serve.sh first, then open a second terminal and run this script.
#
# Usage: ./kiosk-mac.sh [url]
#   url defaults to http://localhost:8080

set -euo pipefail

URL="${1:-http://localhost:8080}"
PROFILE_DIR="/tmp/hmi-poc-chrome-profile"

CHROMIUM_BIN=""
for candidate in \
    "/Applications/Chromium.app/Contents/MacOS/Chromium" \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"; do
  if [[ -x "$candidate" ]]; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: Chromium / Google Chrome not found in /Applications." >&2
  echo "       Install with: brew install --cask chromium" >&2
  exit 1
fi

echo "Launching $CHROMIUM_BIN → $URL"

"$CHROMIUM_BIN" \
  --kiosk \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions \
  --disable-translate \
  --disable-features=TranslateUI \
  --enable-webgl \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --user-data-dir="$PROFILE_DIR" \
  "$URL"
