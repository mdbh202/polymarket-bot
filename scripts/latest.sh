#!/usr/bin/env bash
# Update latest_scan.json symlink to point to the newest scan output
cd "$(dirname "$0")/.."

LATEST=$(ls -t output/scan_*.json 2>/dev/null | head -n 1)
if [ -n "$LATEST" ]; then
  # Use relative path from output/ to the file
  ln -sf "$(basename "$LATEST")" output/latest_scan.json
  echo "Updated output/latest_scan.json -> $(basename "$LATEST")"
fi
