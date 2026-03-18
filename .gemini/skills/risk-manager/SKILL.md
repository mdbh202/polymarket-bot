---
name: risk-manager
description: >-
  Triggers when asked to calculate position size, apply the Kelly criterion,
  check portfolio risk, validate a trade against risk limits, assess open
  position exposure, review drawdown, check whether a trade is within safe
  limits, or size any prediction market bet. Also triggers on casual phrasings:
  "how much should I bet on this", "is this too risky", "size this trade for me",
  "what is my Kelly here", "am I overexposed". Does NOT trigger for general
  investing or non-Polymarket risk management.
license: MIT
metadata:
  author: user
  version: '1.0'
  tags: [risk, kelly, position-sizing, drawdown, portfolio-management]
---

## Overview
The `risk-manager` skill ensures that every trade is mathematically optimized for long-term growth while strictly adhering to the project's risk tolerance. It uses the Kelly Criterion as its foundation, adjusted for the unique fee structure of Polymarket and the inherent uncertainty of AI-driven forecasting.

## Kelly criterion procedure
The agent calculates the optimal position size using the standard Kelly formula, adjusted for the Polymarket binary YES contract.

### Formula
`f* = (p - P) / (1 - P)`
- `p`: The agent's estimated true probability (e.g., 0.70).
- `P`: The current YES market price (e.g., 0.60).

**Why this formula?**
Polymarket binary contracts pay $1.00 on success. The net odds `b` are `(1 - P) / P`. The standard Kelly formula `f* = (b*p - q) / b` (where `q = 1 - p`) simplifies to `(p - P) / (1 - P)` for these contracts.

### Worked Example
- Your estimated P(true) = 0.75
- Market YES price = 0.65
- Full Kelly (f*) = (0.75 - 0.65) / (1 - 0.65) = 0.10 / 0.35 = **0.2857 (28.57%)**

### Fractional Scaling
Always apply a fractional multiplier to the full Kelly `f*` to account for model error and variance.
- **Conservative (0.10x):** Use when CI > +/-0.10 or OI < $10k. Result: 2.85%.
- **Normal (0.25x):** The default. Result: 7.14%.
- **Aggressive (0.33x):** Use only in ideal conditions. Result: 9.42%.

**Final Rule:** Always output the hard-capped value: `min(f* * multiplier, 0.05)`. In this example, even the 0.25x multiplier exceeds the 5% cap, so the final recommendation would be 5% ($50 on a $1000 portfolio).

## Hard limits table

| Limit Type | Hard Cap | Usage Notes |
| :--- | :---: | :--- |
| **Max Single Position** | 5% | Absolute cap per market, regardless of Kelly output. |
| **Max Category Exposure** | 20% | Total portfolio exposed to one category (e.g., Politics). |
| **Max Open Positions** | 15 | Prevents over-fragmentation and monitoring overhead. |
| **Min Open Interest (OI)** | $10,000 | Prevents entering markets with insufficient exit liquidity. |
| **Min After-Fee Edge** | 2.5% | Ensures expected value covers the 2% winning fee and spread. |
| **Max Acceptable Spread** | 15% | Do not enter if the bid/ask spread exceeds 15% of the price. |

## Dynamic scaling rules
Scale the fractional Kelly multiplier based on signal strength:
- **Use 0.10x (Conservative):**
  - Confidence Interval (CI) > +/-0.10.
  - Market Open Interest (OI) < $10k.
  - Market resolves within 24 hours (increased volatility).
  - Fewer than 2 independent Tier 1/2 signals found.
- **Use 0.25x (Normal):** Default for all standard conditions.
- **Use 0.33x (Aggressive):**
  - CI < +/-0.07 AND OI > $100k.
  - 3+ independent Tier 1 signals confirm the direction.
  - After-fee edge > 5%.
- **NEVER** exceed 0.40x under any circumstances.

## Portfolio heat map procedure
Before recommending any new position, the agent must:
1.  **Calculate Category Exposure:** Sum the values of all open positions in the same category as the new trade.
2.  **Check Concentration:** If the category exposure is > 15%, warn the user. If it would exceed 20% with the new trade, the `proceed` flag must be `false`.
3.  **Check Portfolio Invested:** If > 80% of the portfolio is already committed, recommend deferring new trades or closing the lowest-edge existing position.
4.  **Check Drawdown:** If the 7-day portfolio drawdown exceeds 15%, the agent must halt all new entries and reassess all open positions for narrative shifts.

## Stop-condition checklist
- [ ] Spread has widened beyond 20%.
- [ ] Resolution source has become ambiguous or non-functional.
- [ ] New Tier 1 signal contradicts the original trade thesis.
- [ ] Market is within 2 hours of resolution and liquidity is dropping.

## Do-not-trade checklist
- [ ] Cannot identify a clear, official resolution source.
- [ ] Edge is based solely on Tier 3 or Tier 4 signals.
- [ ] Required position would exceed 5% portfolio cap.
- [ ] Market involves sanctioned entities or jurisdictions.
- [ ] Evidence base is fewer than 2 independent Tier 1/2 signals.

## Output format
The `risk-manager` provides a structured assessment:

```json
{
  "kelly_full": 0.2857,
  "kelly_fractional_multiplier": 0.25,
  "kelly_fractional": 0.0714,
  "hard_cap_applied": true,
  "recommended_position_usdc": 50.0,
  "portfolio_pct": 0.05,
  "category_exposure_pct": 0.12,
  "limits_breached": [],
  "proceed": true,
  "notes": "Kelly was 7.14% but capped at 5% portfolio limit. Category exposure remains healthy at 12%."
}
```
