#!/usr/bin/env bash
# Serve the dist/ directory on port 8080
# Usage: ./serve.sh [port]

set -euo pipefail

PORT="${1:-8080}"
DIST_DIR="$(cd "$(dirname "$0")/dist" && pwd)"

if [[ ! -f "$DIST_DIR/index.html" ]]; then
  echo "ERROR: dist/index.html not found. Run 'pnpm build' first." >&2
  exit 1
fi

echo "Serving $DIST_DIR on http://localhost:$PORT"

# Use npx serve if available, fall back to python3
if command -v npx &>/dev/null && npx --yes serve --version &>/dev/null 2>&1; then
  npx serve -s "$DIST_DIR" -l "$PORT"
elif command -v python3 &>/dev/null; then
  python3 -m http.server "$PORT" --directory "$DIST_DIR"
else
  echo "ERROR: Neither 'serve' nor 'python3' found. Install one of them." >&2
  exit 1
fi
