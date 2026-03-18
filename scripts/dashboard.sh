#!/bin/bash

# Polymarket AI Bot Dashboard (LITE)
# Usage: bash scripts/dashboard.sh

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to get current timestamp
get_time() {
    date +"%Y-%m-%d %H:%M:%S"
}

# Main loop
# Use tput for smoother, flicker-free updates
tput civis # Hide cursor
trap "tput cnorm; exit" INT TERM # Show cursor on exit

clear # Clear once at the start to ensure we are at the top

while true; do
    # Check for other dashboard processes (excluding our own)
    OTHER_PIDS=$(pgrep -f "scripts/dashboard.sh" | grep -v "$$")
    
    # 0. Sync Latest Data
    bash "$(dirname "$0")/latest.sh" 2>/dev/null
    
    tput cup 0 0 # Move cursor to top-left instead of clear
    echo -e "${BLUE}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${BLUE}┃${NC}  ${YELLOW}POLYMARKET AI TRADING BOT DASHBOARD${NC}                     $(get_time)  ${BLUE}┃${NC}"
    echo -e "${BLUE}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
    
    # 1. System Status
    WATCH_PID=$(pgrep -f watch.sh || echo "NONE")
    echo -e "${CYAN}[ SYSTEM STATUS ]${NC}"
    if [ "$WATCH_PID" != "NONE" ]; then
        echo -e "  Feed Service: ${GREEN}ACTIVE${NC} (PID: $WATCH_PID)"
    else
        echo -e "  Feed Service: ${RED}STOPPED${NC} (Run: bash scripts/watch.sh &)"
    fi
    
    if [ -n "$OTHER_PIDS" ]; then
        echo -e "  Dashboard:    ${YELLOW}WARNING: MULTIPLE INSTANCES RUNNING${NC}"
    fi
    
    echo -e "  Portfolio:    ${YELLOW}1,000 USDC${NC}"
    
    # Calibration (Brier) logic
    CALIB="PENDING"
    if [ -f output/predictions.jsonl ]; then
        CALIB=$(jq -rs 'map(select(.brier_score != null).brier_score) as $scores | if ($scores | length) > 0 then ($scores | add / ($scores | length) | tostring)[:6] else "PENDING" end' output/predictions.jsonl 2>/dev/null)
    fi
    echo -e "  Calibration:  ${CYAN}${CALIB}${NC} (Brier Score)"
    echo
    
    # 2. Live Market Feed (Top 5 by Volume)
    echo -e "${CYAN}[ LIVE MARKET FEED ]${NC}"
    echo -e "${BLUE}ID      | Market Question                               | Price | Vol 24h${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -f output/latest_scan.json ]; then
        # Check if it's a raw array (from watch.sh) or an AI report (from scan.sh)
        if jq -e 'type == "array"' output/latest_scan.json >/dev/null 2>&1; then
            jq -r '.[:5] | .[] | "\((.id | tostring + "       ")[:7]) | \((if .question|length > 45 then .question[:42] + "..." else .question end + "                                             ")[:45]) | \((if .outcomePrices then (.outcomePrices|fromjson[0]|tonumber|tostring + "     ")[:5] else "0.000" end)) | \((.volume24hr|tonumber / 1000000 | floor | tostring) + "M")"' output/latest_scan.json 2>/dev/null
        else
            jq -r '.markets[:5] | .[] | "\((.market_id | tostring + "       ")[:7]) | \((if .question|length > 45 then .question[:42] + "..." else .question end + "                                             ")[:45]) | \((.market_price|tonumber|tostring + "     ")[:5]) | \((.after_fee_edge|tonumber * 100 | floor | tostring) + "%")"' output/latest_scan.json 2>/dev/null
        fi
    else
        echo -e "  ${YELLOW}Waiting for first background scan results...${NC}"
    fi
    
    echo
    
    # 3. Recent Signals
    echo -e "${CYAN}[ RECENT SIGNALS & ALERTS ]${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ -f output/predictions.jsonl ]; then
        tail -n 3 output/predictions.jsonl | jq -r '"  - \(.question)"' 2>/dev/null
    else
        echo -e "  ${YELLOW}No signals recorded.${NC}"
    fi
    
    echo
    echo -e "${BLUE}Press Ctrl+C to exit. Updates every 5s.${NC}"
    # Use tput ed to clear anything remaining below
    tput ed
    sleep 5
done
