#!/bin/bash
# watch.sh - Simple CURL Version
# Purpose: Background market monitoring using direct API calls

cd "$(dirname "$0")/.."
mkdir -p output

echo "Polymarket Simple Monitor Started."

while true; do
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    FILE="output/scan_${TIMESTAMP}.json"
    
    # Direct Gamma API call for top 10 active markets by volume
    curl -s "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&order=volume24hr&ascending=false" > "$FILE"
    
    # Check if we got valid JSON (should start with [)
    if grep -q "^\[" "$FILE"; then
        cp "$FILE" output/latest_scan.json
        echo "Scan updated: $(date)"
    else
        echo "Scan failed at $(date): API returned non-JSON"
    fi
    
    # Clean up old scans
    find output -name "scan_*.json" -mmin +60 -delete
    
    sleep 300
done
