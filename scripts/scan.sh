#!/usr/bin/env bash
set -euo pipefail

# Default Arguments
LIMIT=20
MIN_EDGE=0.03
MODEL="${GEMINI_MODEL:-gemini-2.5-pro}"
OUTPUT_DIR="${OUTPUT_DIR:-./output}"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --limit) LIMIT="$2"; shift ;;
        --min-edge) MIN_EDGE="$2"; shift ;;
        --model) MODEL="$2"; shift ;;
        --output-dir) OUTPUT_DIR="$2"; shift ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# Pre-flight checks
if ! command -v gemini &> /dev/null; then
    echo "Error: 'gemini' CLI is not installed."
    exit 1
fi

if [ -z "${GOOGLE_API_KEY:-}" ]; then
    echo "Error: GOOGLE_API_KEY is not set in the environment."
    exit 1
fi

if [ -z "${PORTFOLIO_SIZE_USDC:-}" ]; then
    echo "Error: PORTFOLIO_SIZE_USDC is not set in the environment."
    exit 1
fi

if [ ! -d "mcp/node_modules" ]; then
    echo "Error: MCP dependencies missing. Run: bash scripts/setup.sh"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
PREDICTIONS_FILE="${OUTPUT_DIR}/predictions.jsonl"
touch "$PREDICTIONS_FILE"

PROMPT="Scan the top ${LIMIT} Polymarket markets by open interest and volume.
For each market: run the full superforecasting research protocol, estimate
the true probability, calculate after-fee edge, and apply Kelly sizing.
Filter 'markets' to those where after-fee edge exceeds ${MIN_EDGE}.
Include a 'predictions' array containing an entry for EVERY market analyzed (not just recommended ones).
Use get_markets, get_orderbook, search_news, and get_prediction_market_consensus
tools as needed. Portfolio size: \$${PORTFOLIO_SIZE_USDC} USDC.
Return ONLY a valid JSON object with this exact schema:
{
  \"scanned_at\": \"<ISO8601 timestamp>\",
  \"portfolio_usdc\": <number>,
  \"markets_scanned\": <number>,
  \"opportunities_found\": <number>,
  \"markets\": [
    {
      \"market_id\": \"<string>\",
      \"question\": \"<string>\",
      \"category\": \"<string>\",
      \"resolution_date\": \"<ISO8601>\",
      \"direction\": \"YES\" or \"NO\",
      \"market_price\": <number>,
      \"true_probability\": <number>,
      \"confidence_level\": \"HIGH\" or \"MEDIUM\" or \"LOW\",
      \"raw_edge\": <number>,
      \"after_fee_edge\": <number>,
      \"kelly_full\": <number>,
      \"kelly_fraction\": <number>,
      \"kelly_multiplier\": <number>,
      \"position_usdc\": <number>,
      \"strategy\": \"<string>\",
      \"score\": <number>,
      \"key_signal\": \"<string>\",
      \"risk_note\": \"<string>\"
    }
  ],
  \"predictions\": [
    {
      \"market_id\": \"<string>\",
      \"question\": \"<string>\",
      \"predicted_p\": <number>,
      \"market_p\": <number>,
      \"timestamp\": \"<ISO8601>\",
      \"is_recommended\": <boolean>,
      \"status\": \"pending\",
      \"actual_outcome\": null,
      \"brier_score\": null
    }
  ]
}
Sort markets array by score descending. Output only the JSON, no other text."

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="${OUTPUT_DIR}/scan_${TIMESTAMP}.json"

echo "Running scan with model: $MODEL..."
gemini --model "$MODEL" --output-format json -y -p "$PROMPT" > "$OUTFILE"

# Check output is valid JSON
if ! jq empty "$OUTFILE" 2>/dev/null; then
    echo "Warning: output may not be valid JSON. Check $OUTFILE"
else
    # Append predictions to jsonl
    jq -c '.predictions[]' "$OUTFILE" >> "$PREDICTIONS_FILE"

    # Print human-readable summary
    echo "----------------------------------------"
    echo "Scan complete: $(jq '.markets_scanned' "$OUTFILE") markets scanned"
    echo "Opportunities found: $(jq '.opportunities_found' "$OUTFILE")"
    echo "----------------------------------------"
    
    jq -r '.markets[] | "• Q: \(.question)\n  Dir: \(.direction) | Edge: \((.after_fee_edge * 100) | round)% | Pos: $\(.position_usdc)\n"' "$OUTFILE"
fi

echo "Full output saved to: $OUTFILE"
