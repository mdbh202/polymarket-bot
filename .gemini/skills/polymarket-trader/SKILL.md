---
name: polymarket-trader
description: >-
  Triggers when the user asks to analyse Polymarket markets, find trade
  opportunities, scan for prediction market edge, assess event probabilities,
  run a market scan, build a Polymarket portfolio, size a Polymarket position,
  or apply Kelly criterion to a prediction market bet. Also triggers on casual
  phrasings like "any good trades on polymarket", "check polymarket for me",
  "what markets should I bet on", "find me some edge". Does NOT trigger for
  crypto price prediction unrelated to Polymarket, general financial forecasting,
  stock market analysis, or sports betting outside Polymarket.
license: MIT
metadata:
  author: user
  version: '1.0'
  tags: [polymarket, prediction-markets, trading, kelly, superforecasting, edge]
compatibility:
  tools: [GoogleSearch, WebFetch, get_markets, get_orderbook, get_history, search_news, get_prediction_market_consensus]
---

## Overview
The `polymarket-trader` skill is the primary orchestrator for the Polymarket AI trading bot. It implements a rigorous, data-driven approach to prediction market trading by combining real-time market data with deep research and a systematic superforecasting engine. It ensures that every trade is backed by a calculated edge and appropriate risk management.

## Activation context
Upon activation, the agent must first read the foundational `GEMINI.md` operating instructions. It should then confirm that the necessary MCP tools are available by performing a test call to `get_markets` with `limit=1`. If any essential tools are unavailable, this must be logged and reported to the user before proceeding.

## Workflow
1. **Fetch markets:** Retrieve active markets using `get_markets`, filtering by volume or specific user queries.
2. **Research:** Gather signals across all four tiers (official, news, consensus, sentiment).
3. **Forecast:** Apply the superforecasting engine to calculate a true probability P(true) based on base rates and evidence updates.
4. **Edge calc:** Calculate the raw edge and the after-fee edge (subtracting 2% winning fee).
5. **Kelly sizing:** Determine the optimal position size using the Polymarket-specific Kelly formula and appropriate fractional multipliers.
6. **Format output:** Generate a structured report using the standard template.
7. **Rank:** If multiple opportunities are analyzed, rank them by their score (edge * confidence * liquidity).

## Strategy selection
The agent evaluates strategies in the following order and stops at the first match:
- **IF YES_price + NO_price < 0.975:** Apply **Strategy 2: Rebalancing Arbitrage**.
- **IF logically inconsistent related markets show divergence > 3%:** Apply **Strategy 3: Combinatorial Arbitrage**.
- **IF Tier 1/2 confirmed news not reflected in price:** Apply **Strategy 4: News-Lag Latency**.
- **IF P(true) diverges from P(market) by > 3% after-fee edge:** Apply **Strategy 1: Fundamental Prediction Trading**.
- **IF large wallet move in low-liquidity market:** Layer as **Strategy 5: Smart-Money Signal**.

## Output format
The agent must use the following structured template for all assessments:

```
### MARKET ASSESSMENT: [Market Question]
- **CONDITION_ID**: [ID]
- **CATEGORY**: [Category]
- **RESOLUTION_DATE**: [Date]

#### RESEARCH SUMMARY
- **Signals Used**: [List Tiers/Sources]
- **Key Finding**: [Primary reason for estimate]
- **Uncertainty Flags**: [List any]

#### PROBABILITY ASSESSMENT
- **Base Rate**: [Frequency]
- **Adjusted P(YES)**: [Float]
- **Confidence Interval**: [+/- X]
- **Confidence Level**: [HIGH/MEDIUM/LOW]

#### MARKET ANALYSIS
- **Current Prices**: YES: [Price], NO: [Price]
- **Spread**: [Value]
- **Open Interest**: [Amount]
- **Strategy Type**: [Strategy Name]

#### TRADE RECOMMENDATION
- **Direction**: [YES/NO]
- **Raw Edge**: [X%]
- **After-fee Edge**: [Y%]
- **Kelly Fraction (f*)**: [Value]
- **Fractional Multiplier**: [X.XX] (Reason: [Reason])
- **Suggested Position**: $[Amount] USDC
- **Entry Target**: $[Price]
- **Take-profit Target**: [Price or Resolution]
- **Exit Condition**: [Stop condition]

**RISK_NOTE**: [Specific risk warning]
```

## Edge cases
- **No liquid market found (OI < $10k):** Log the market and skip it. Report this in the final summary.
- **Contradicting signals with no resolution:** Output NO TRADE and explain the specific source of the conflict.
- **Market within 2 hours of resolution:** Skip the market unless a clear arbitrage opportunity exists.
- **Arb opportunity found mid-analysis:** Immediately prioritize the arbitrage opportunity, document it separately, and then continue with fundamental analysis if applicable.

## Skills to invoke
- Delegate signal gathering to the `market-researcher` skill.
- Delegate position sizing validation to the `risk-manager` skill.
