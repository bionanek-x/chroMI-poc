#!/usr/bin/env bash
# Launch Chromium in kiosk mode for a physical Linux device with a real GPU.
# Uses native OpenGL via ANGLE — requires a working GPU driver (see README).
# Run ./serve.sh first, then open a second terminal and run this script.
#
# Usage: ./kiosk-physical.sh [url] [display]
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
    /usr/bin/google-chrome-stable; do
  if command -v "$candidate" &>/dev/null || [[ -x "$candidate" ]]; then
    CHROMIUM_BIN="$candidate"
    break
  fi
done

if [[ -z "$CHROMIUM_BIN" ]]; then
  echo "ERROR: Chromium / Google Chrome not found. Install it first." >&2
  exit 1
fi

# Sanity-check: warn if OpenGL renderer is llvmpipe (software fallback)
if command -v glxinfo &>/dev/null; then
  RENDERER=$(glxinfo 2>/dev/null | grep "OpenGL renderer" | head -1 || true)
  if echo "$RENDERER" | grep -qi "llvmpipe\|softpipe\|swiftshader"; then
    echo "WARNING: GPU driver appears to be software-rendered: $RENDERER"
    echo "         Check your GPU driver installation before treating FPS as real."
    echo "         See the README — 'GPU Driver Prerequisites' section."
    echo ""
  else
    echo "GPU: $RENDERER"
  fi
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
  --use-angle=gl \
  --enable-webgl \
  --enable-gpu-rasterization \
  --enable-zero-copy \
  --ignore-gpu-blocklist \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --touch-events=enabled \
  --user-data-dir="$PROFILE_DIR" \
  "$URL"
