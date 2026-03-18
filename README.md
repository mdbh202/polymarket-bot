# Polymarket AI Trading Bot

This is a complete, production-ready AI trading agent designed to identify and exploit edge on Polymarket. It combines real-time market data with deep research and a systematic superforecasting engine to provide calibrated probability estimates and risk-managed trade recommendations.

## Prerequisites
- **Node.js >= 18**: Required for MCP servers and script utilities.
- **Gemini CLI**: The interactive agent runner ([Installation Guide](https://github.com/google/gemini-cli)).
- **Google AI Studio API Key**: Required for Gemini model access ([Get a key](https://aistudio.google.com)).
- **Optional**: newsdata.io API key for live news feed integration.

## Quick Start
1.  **Initialize the project:**
    ```bash
    bash scripts/setup.sh
    ```
2.  **Configure your environment:**
    Open the newly created `.env` file and fill in your `GOOGLE_API_KEY`, `PORTFOLIO_SIZE_USDC`, and other optional keys.
3.  **Load the environment:**
    ```bash
    source .env
    ```
4.  **Start trading:**
    ```bash
    gemini
    ```

## Running Scripts
- **Market Scanning:** Run an automated scan of top markets.
  ```bash
  bash scripts/scan.sh --limit 10 --min-edge 0.05
  ```
- **Continuous Monitoring:** Watch the market for changes in edge and price.
  ```bash
  bash scripts/watch.sh --interval 600
  ```
- **Kelly Calculator:** Manually size a position.
  ```bash
  node scripts/kelly.js --p 0.72 --market 0.65 --portfolio 1000
  ```

## Project Structure
- `GEMINI.md`: Foundational project context and operating mandates for the AI agent.
- `.gemini/settings.json`: Configuration for model parameters and MCP server integration.
- `.gemini/skills/`: Specialized agent logic for trading, research, and risk management.
- `mcp/`: Node.js Model Context Protocol servers for Polymarket and News APIs.
- `scripts/`: Bash and Node.js utilities for setup, scanning, and position sizing.
- `output/`: Directory where automated scan JSON results are stored.

## How the Skill System Works
The bot uses three primary skills to ensure high-fidelity decision making:
1.  **Polymarket Trader**: Triggers on queries like "find me some edge." It orchestrates the full workflow from discovery to sizing.
2.  **Market Researcher**: Triggers when deep evidence gathering is needed. It implements a 4-tier signal sweep and anchors in base rates.
3.  **Risk Manager**: Triggers when calculating position sizes. It enforces hard caps (e.g., 5% max per position) and category limits.

## MCP Servers
- **Polymarket Server**: Exposes `get_markets`, `get_orderbook`, and `get_history`. It directly interfaces with the Gamma, CLOB, and Data APIs.
- **News Server**: Exposes `search_news` and `get_prediction_market_consensus`. It integrates news data and Metaculus community consensus for Bayesian updates.

## Model Selection Guide
- `gemini-2.5-pro`: The default stable model. Excellent for deep, multi-source research.
- `gemini-3.1-pro-preview`: Best for complex, agentic reasoning and long-tail prediction markets.
- `gemini-3.1-flash-lite-preview`: Significantly faster; ideal for rapid initial scanning passes.
*You can switch models using the `--model` flag in scripts or by setting `GEMINI_MODEL` in your `.env`.*

## Troubleshooting
- **MCP Servers fail to start:** Ensure you have run `bash scripts/setup.sh` and that Node.js >= 18 is in your PATH.
- **API Key Errors:** Verify that `GOOGLE_API_KEY` is exported in your current shell session.
- **JSON Formatting:** If `scan.sh` fails to produce valid JSON, check the log files in `output/` for specific model errors.

## Risk Disclaimer
Prediction markets involve significant financial risk. This project is a research and analysis tool designed to assist in decision-making; it does not guarantee profit. Always apply your own judgment and never risk capital you cannot afford to lose. This software is provided under the MIT License.

## License
MIT
