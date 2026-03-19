# Polymarket AI Trading Bot

This is a complete, production-ready AI trading agent designed to identify and exploit edge on Polymarket. It combines real-time market data with deep research and a systematic superforecasting engine to provide calibrated probability estimates and risk-managed trade recommendations.

## 🚀 2026 Upgrades: Autonomous Execution & Niche Alpha
The bot has been upgraded for the 2026 Polymarket landscape, focusing on high-signal niche markets and automated execution with a hardcoded Risk Shield.

### Key New Features
- **Autonomous Execution**: The `place_order` tool allows the bot to sign and post trades directly to the CLOB.
- **Risk Shield**: Hardcoded $50 USDC per-trade cap and 2% slippage protection enforced at the tool level.
- **Niche Pivot**: Targeted scanning of low-liquidity markets ($5k–$50k OI) where AI has a comparative advantage over speed-focused HFT bots.
- **Self-Ensemble Reasoning**: Mandatory 3-persona reasoning (Bayesian, Sentiment, Domain) for more robust probability estimates.
- **Zen 2.0 TUI**: A revamped, minimalist dashboard with high-density market grids and visual probability bars.
- **Performance Audit**: High-precision telemetry tracking trade latency and automated Brier score calibration analysis.

## Prerequisites
- **Node.js >= 18**: Required for MCP servers and script utilities.
- **Python >= 3.9**: Required for the Zen TUI dashboard and Audit script.
- **Gemini CLI**: The interactive agent runner ([Installation Guide](https://github.com/google/gemini-cli)).
- **Google AI Studio API Key**: Required for Gemini model access ([Get a key](https://aistudio.google.com)).
- **Optional**: newsdata.io API key for live news feed integration.

*Note: Run `pip install -r requirements.txt` to install Python dependencies.*

## Quick Start
1.  **Initialize the project:**
    ```bash
    bash scripts/setup.sh
    ```
2.  **Configure your environment:**
    Open the newly created `.env` file and fill in your keys. For trading, you need `POLYMARKET_PRIVATE_KEY` (64-char hex or 44-char base64), `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, and `POLYMARKET_API_PASSPHRASE`.
3.  **Load the environment:**
    ```bash
    export $(grep -v '^#' .env | xargs)
    ```
4.  **Start the Dashboard:**
    ```bash
    python3 scripts/dashboard.py
    ```

## Running Scripts
- **Niche Market Scan (Recommended):** Focus on the long-tail niche edge.
  ```bash
  bash scripts/scan_niche.sh
  ```
- **Standard Market Scan:** Top 20 high-volume markets.
  ```bash
  bash scripts/scan.sh --limit 10 --min-edge 0.05
  ```
- **Logical Inconsistency Check:** Find mathematical price gaps in related markets.
  ```bash
  node scripts/find_inconsistencies.js
  ```
- **Performance Audit:** Analyze trade latency and prediction accuracy.
  ```bash
  python3 scripts/audit_accuracy.py
  ```
- **Live Dashboard (Zen 2.0):** Monitor bot status, market feed, and trades in real-time. Supports hotkeys: `n` (Niche Scan), `s` (Standard Scan), `r` (Refresh).
  ```bash
  python3 scripts/dashboard.py
  ```

## Project Structure
- `GEMINI.md`: Foundational project context and operating mandates for the AI agent.
- `mcp/`: Model Context Protocol servers for Polymarket and News APIs.
- `scripts/`: Utilities for scanning, logic checking, auditing, and the Zen 2.0 TUI.
- `output/`: Directory for scan results, `predictions.jsonl`, `trades.jsonl`, and `audit_results.json`.

## Calibration & Accuracy
The bot tracks its own performance using the **Brier Score** $(p - o)^2$ and ensemble-level breakdowns.
- **Resolution:** Running `node scripts/resolve_predictions.js` updates scores.
- **Audit:** `python3 scripts/audit_accuracy.py` generates a full report on latency and calibration.

## Risk Disclaimer
Prediction markets involve significant financial risk. This bot includes a hardcoded $50 Risk Shield, but you are responsible for any funds used. Always use a dedicated test wallet. This software is provided under the MIT License.

## License
MIT
