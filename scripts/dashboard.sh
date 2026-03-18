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
while true; do
    clear
    echo -e "${BLUE}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓${NC}"
    echo -e "${BLUE}┃${NC}  ${YELLOW}POLYMARKET AI TRADING BOT DASHBOARD${NC}                     $(get_time)  ${BLUE}┃${NC}"
    echo -e "${BLUE}┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${NC}"
    
    # 1. System Status
    WATCH_PID=$(pgrep -f watch.sh || echo "NONE")
    echo -e "${CYAN}[ SYSTEM STATUS ]${NC}"
    if [ "$WATCH_PID" != "NONE" ]; then
        echo -e "  Background:   ${GREEN}ACTIVE${NC} (PID: $WATCH_PID)"
    else
        echo -e "  Background:   ${RED}STOPPED${NC}"
    fi
    echo -e "  Portfolio:    ${YELLOW}1,000 USDC${NC}"
    echo -e "  Feed Status:  $(if [ -f output/latest_scan.json ]; then echo -e "${GREEN}LIVE${NC}"; else echo -e "${YELLOW}WAITING${NC}"; fi)"
    echo
    
    # 2. Live Market Feed (Top 5 by Volume)
    echo -e "${CYAN}[ LIVE MARKET FEED ]${NC}"
    echo -e "${BLUE}ID      | Market Question                               | Price | Vol 24h${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [ -f output/latest_scan.json ]; then
        # Check if it's a raw array (from watch.sh) or an AI report (from scan.sh)
        if jq -e 'type == "array"' output/latest_scan.json >/dev/null 2>&1; then
            MARKETS_JSON='.'
        else
            MARKETS_JSON='.markets'
        fi

        jq -r "$MARKETS_JSON[:5] | .[] | \"\(.id | tostring | (. + \\\"       \\\")[:7]) | \((if .question|length > 45 then .question[:42] + \\\"...\\\" else .question end) | (. + \\\"                                             \\\")[:45]) | \((if .outcomePrices then (.outcomePrices|fromjson[0]|tonumber|tostring|(. + \\\"     \\\")[:5]) else \\\"0.000\\\" end)) | \((.volume24hr|tonumber / 1000000 | floor | tostring) + \\\"M\\\")\"" output/latest_scan.json 2>/dev/null
    else
        echo -e "  ${YELLOW}Waiting for first background scan results...${NC}"
    fi
    
    echo
    
    # 3. Recent Alerts / Sentiment
    echo -e "${CYAN}[ RECENT SIGNALS & ALERTS ]${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ -f output/latest_scan.json ]; then
        if jq -e 'type == "array"' output/latest_scan.json >/dev/null 2>&1; then
            MARKETS_JSON='.'
        else
            MARKETS_JSON='.markets'
        fi
        jq -r "$MARKETS_JSON[:3] | .[] | \"  - \(.question)\"" output/latest_scan.json 2>/dev/null
    else
        echo -e "  ${YELLOW}Waiting for news analysis...${NC}"
    fi
    
    echo
    
    # 4. Forecaster Calibration
    echo -e "${CYAN}[ FORECASTER CALIBRATION ]${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    if [ -f output/predictions.jsonl ]; then
        AVG_BRIER=$(jq -rs 'map(select(.brier_score != null).brier_score) as $scores | if ($scores | length) > 0 then ($scores | add / ($scores | length) | tostring) else "PENDING" end' output/predictions.jsonl 2>/dev/null)
        if [ "$AVG_BRIER" != "PENDING" ]; then
            echo -e "  Avg Brier Score: ${YELLOW}$AVG_BRIER${NC} (Lower is better)"
        else
            echo -e "  Avg Brier Score: ${YELLOW}PENDING${NC} (Waiting for market resolution)"
        fi
    else
        echo -e "  ${YELLOW}Waiting for prediction history...${NC}"
    fi

    echo
    echo -e "${BLUE}Press Ctrl+C to exit dashboard.${NC}"
    sleep 5
done
