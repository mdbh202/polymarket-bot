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

# Create output directory
mkdir -p "$OUTPUT_DIR"
PREDICTIONS_FILE="${OUTPUT_DIR}/predictions.jsonl"
touch "$PREDICTIONS_FILE"

# SELF-ENSEMBLE PROMPT (Edge 1 & 2)
# Targets niche markets ($5k-$50k liquidity) where AI has a comparative advantage over HFT bots.
PROMPT="Scan niche Polymarket markets with open interest between \$5,000 and \$50,000.
Use 'get_markets' with min_liquidity=5000 and max_liquidity=50000.

For each market found:
1. RUN SELF-ENSEMBLE REASONING:
   - Path A (Bayesian): Start with the base rate and update based on current evidence.
   - Path B (Sentiment): Gauge if the market is over-reacting to news or 'narrative bias'.
   - Path C (Domain Expert): Analyze specific resolution criteria and primary data sources.
   - FINAL P(true): Average the three paths to form your calibrated probability.

2. EXECUTION:
   - Calculate after-fee edge: P(true) - P(market) - 0.02.
   - If after-fee edge > 5%, you MUST execute a trade using 'place_order'.
   - Hard cap per trade: \$50 USDC. NEVER exceed this.

Include a 'predictions' array for EVERY market analyzed.
Portfolio size: \$${PORTFOLIO_SIZE_USDC} USDC.
Return ONLY valid JSON:
{
  \"scanned_at\": \"<ISO8601>\",
  \"portfolio_usdc\": <number>,
  \"markets_scanned\": <number>,
  \"opportunities_found\": <number>,
  \"markets\": [
    {
      \"market_id\": \"<string>\",
      \"question\": \"<string>\",
      \"direction\": \"YES\" or \"NO\",
      \"true_probability\": <number>,
      \"after_fee_edge\": <number>,
      \"position_usdc\": <number>,
      \"ensemble_breakdown\": {
        \"bayesian\": <number>,
        \"sentiment\": <number>,
        \"domain\": <number>
      },
      \"key_signal\": \"<string>\"
    }
  ],
  \"predictions\": [
  {
  \"market_id\": \"<string>\",
  \"question\": \"<string>\",
  \"predicted_p\": <number>,
  \"market_p\": <number>,
  \"ensemble_breakdown\": {
    \"bayesian\": <number>,
    \"sentiment\": <number>,
    \"domain\": <number>
  },
  \"timestamp\": \"<ISO8601>\",
  \"is_recommended\": <boolean>,
  \"status\": \"pending\"
  }
  ]
  }
  No other text.\"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTFILE="${OUTPUT_DIR}/scan_niche_${TIMESTAMP}.json"

echo "Running niche scan (Edge 1 & 2) with model: $MODEL..."
# Capture output to temp variable first to avoid writing errors to OUTFILE
RAW_OUT=$(gemini --model "$MODEL" --output-format json -y -p "$PROMPT" 2>/dev/null || echo "{\"error\": \"Gemini CLI failed\"}")

if echo "$RAW_OUT" | jq empty 2>/dev/null; then
    echo "$RAW_OUT" > "$OUTFILE"
    # Append predictions to jsonl
    jq -c '.predictions[]?' "$OUTFILE" >> "$PREDICTIONS_FILE"
    echo "----------------------------------------"
    SCANNED=$(jq '.markets_scanned // 0' "$OUTFILE")
    FOUND=$(jq '.opportunities_found // 0' "$OUTFILE")
    echo "Niche Scan complete: $SCANNED markets scanned"
    echo "Opportunities found: $FOUND"
    echo "----------------------------------------"
    jq -r '.markets[]? | "• Q: \(.question)\n  Edge: \((.after_fee_edge * 100 | round))% | Pos: $\(.position_usdc)\n  Ensemble: [B:\(.ensemble_breakdown.bayesian) S:\(.ensemble_breakdown.sentiment) D:\(.ensemble_breakdown.domain)]\n"' "$OUTFILE"
else
    echo "Error: Gemini returned invalid JSON or failed."
    echo "{\"error\": \"Invalid JSON from model\"}" > "$OUTFILE"
fi
"