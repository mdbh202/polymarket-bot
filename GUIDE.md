# Polymarket AI Bot: User Guide (2026 Edition)

Welcome to the elite prediction market trading suite. This guide will walk you through setting up, monitoring, and executing trades using the "Niche Alpha" and "Autonomous Execution" layers.

---

## 1. Initial Setup

### Step 1: Environment Configuration
Copy `.env.example` to `.env` and fill in your keys.
```bash
cp .env.example .env
```
**Required Keys for Trading:**
- `GOOGLE_API_KEY`: For the Gemini 2.5 Pro reasoning engine.
- `POLYMARKET_PRIVATE_KEY`: Your Polygon wallet key (64-char hex or 44-char base64).
- `POLYMARKET_API_KEY`, `SECRET`, `PASSPHRASE`: Obtained from your Polymarket Profile (API section).

### Step 2: Load the Engine
Every time you open a new terminal, you must export your environment:
```bash
export $(grep -v '^#' .env | xargs)
```

---

## 2. The Zen 2.0 Dashboard

The dashboard is your command center. It provides a real-time, minimalist view of market opportunities and your trade history.

**To Launch:**
```bash
python3 scripts/dashboard.py
```

### Dashboard Controls:
- **`n`**: Trigger a **Niche Scan**. Targets markets with $5k–$50k liquidity where human attention is low.
- **`s`**: Trigger a **Standard Scan**. Scans the top 20 high-volume markets.
- **`r`**: Refresh the UI manually.
- **`q`**: Quit the dashboard.

### Visual Indicators:
- **P-Bar (`|---M---T---|`)**: Visualizes the gap between the Market price (**M**) and our AI Forecast (**T**).
- **Ensemble [B: S: D:]**: Shows the probability breakdown from the three reasoning paths (Bayesian, Sentiment, Domain).

---

## 3. Autonomous Execution & Safety

The bot is authorized to take trades automatically during a scan if the **After-fee Edge is > 5%**.

### The Risk Shield
To protect your capital, the following limits are hardcoded into the execution tool:
1.  **$50 Hard Cap**: No single trade will ever exceed $50 USDC, regardless of the AI's suggestion.
2.  **2% Slippage Protection**: If the price moves more than 2% away from the last trade price during execution, the trade is automatically rejected.
3.  **Fill-or-Kill (FOK)**: Orders are atomic; they either fill completely at your price or don't fill at all.

### Common Rejection: 403 Forbidden
If you see a `FAIL` in the trade table with a `403` code, it means Polymarket is blocking the trade based on your current IP address (Regional Restriction).

---

## 4. Advanced Strategies

### Niche Alpha (Edge 1)
Run this to find mispricings in low-liquidity markets that HFT bots ignore:
```bash
bash scripts/scan_niche.sh
```

### Logical Inconsistency (Edge 5)
Run this to find mathematical gaps between related markets (e.g., if the sum of YES prices for a "Winner" category exceeds 100%):
```bash
node scripts/find_inconsistencies.js
```

---

## 5. Performance Auditing

The bot tracks its own latency and accuracy. Use this to ensure your "Edge" is real.

**Run the Audit:**
```bash
python3 scripts/audit_accuracy.py
```
This generates `output/audit_results.json`, which tracks:
- **Brier Score**: How accurate the ensemble is vs. individual paths.
- **RTT Latency**: The round-trip time for your trades (target < 1s).

---

## 6. Maintenance

- **Resolve Predictions**: After markets close, run this to update your Brier scores:
  ```bash
  node scripts/resolve_predictions.js
  ```
- **Cleanup**: Logs and scan results are stored in `output/`. Periodically archive this folder if it becomes too large.

---

**Disclaimer:** This bot is a research tool. Prediction markets involve risk. Never trade with more than you can afford to lose.
