---
name: market-researcher
description: >-
  Triggers when asked to research a prediction market event, gather signals for
  a Polymarket question, find base rates for a binary outcome, cross-reference
  forecasting platforms, assess news relevance for a prediction, or sweep for
  evidence on an upcoming event. Also triggers on: "what does the evidence say
  about X", "find signals for this market", "look up base rates for", "check
  Metaculus on this", "is there any news on". Does NOT trigger for general news
  summarisation, stock research, or non-prediction-market contexts.
license: MIT
metadata:
  author: user
  version: '1.0'
  tags: [research, signals, superforecasting, metaculus, base-rates, polymarket]
---

## Overview
The `market-researcher` skill is responsible for the deep information gathering required for superforecasting. It systematically sweeps through multiple tiers of information, ranging from official government data to secondary news and expert consensus, to build a robust evidence base for probability estimation.

## Research workflow
The research phase uses `GoogleSearch` and `WebFetch` to populate the evidence base. For each category, use the following tiered query templates:

### Politics
- **Tier 1:** "[Candidate/Event] official polling average 538", "Silver Bulletin [Event] forecast", "official [State/Country] election board results [Year]"
- **Tier 2:** "Reuters [Event] primary reporting", "Associated Press [Event] live updates", "WSJ [Event] analysis"
- **Tier 3:** "Twitter [Event] sentiment analysis", "Reddit [Event] consensus thread", "Google Trends [Candidate] volume"

### Economics
- **Tier 1:** "BLS CPI release [Month/Year] official", "FOMC statement [Date] summary", "Fed FRED [Economic Indicator] current data"
- **Tier 2:** "Bloomberg [Indicator] consensus forecast", "FT [Indicator] analysis", "WSJ Economic [Indicator] report"
- **Tier 3:** "CNBC [Indicator] live commentary", "Twitter economists [Indicator] predictions", "Metaculus [Indicator] community probability"

### Crypto
- **Tier 1:** "Ethereum [Upgrade Name] official EIP status", "Bitcoin [Event] official developer announcement", "SEC filing [Crypto Asset] status"
- **Tier 2:** "The Block [Event] deep dive", "CoinDesk [Event] reporting", "Messari [Event] research"
- **Tier 3:** "Twitter [Token] developer activity", "Reddit r/CryptoCurrency [Event] consensus", "Glassnode [Asset] on-chain metrics"

### Sports
- **Tier 1:** "ESPN official [League] standings", "Official [League] box score [Date]", "NBA/NFL/UFC official result [Event]"
- **Tier 2:** "Bleacher Report [Team/Event] primary update", "The Athletic [Team/Event] analysis", "FiveThirtyEight sports forecast [Team]"
- **Tier 3:** "Twitter [Player] injury status", "Reddit r/[Sport] discussion [Event]", "Google Trends [Matchup] popularity"

### Science & Culture
- **Tier 1:** "Nature [Paper Name] official publication", "NASA [Mission Name] official update", "Pew Research [Culture Trend] data"
- **Tier 2:** "Scientific American [Event] reporting", "New York Times Science [Topic] analysis", "National Geographic [Event] primary report"
- **Tier 3:** "Twitter science community [Event] consensus", "Reddit r/Science [Event] discussion", "Metaculus [Event] forecaster count"

## Forecasting platform cross-reference
- **Metaculus:** Search `metaculus.com/api2/questions?search=<keywords>`. Only use the community prediction if `forecaster_count` > 50. Flag if the matched question wording differs from the Polymarket question.
- **Manifold:** Search `manifold.markets/find?q=<keywords>`. Use implied probability only if volume > $500 equivalent.
- **Kalshi:** Compare the Kalshi price to the Polymarket price for the same event. A divergence > 5% is a Tier 2 signal that requires investigating which market has higher liquidity or more recent news.

## Base rate protocol
1. **Identify the reference class:** Determine the general category of the event (e.g., presidential incumbents, interest rate changes).
2. **Find historical frequency:** Use `GoogleSearch` + `WebFetch` on Wikipedia, 538, or academic repositories to find N occurrences out of M total cases.
3. **Report data:** Format as "N/M (X%) win rate" with source and specific date range (e.g., 1950-2024).

## Conflict resolution
- **If Tier 1 signals contradict:** Report both signals and their specific sources. Recommend NO TRADE unless one source is significantly more authoritative or recent.
- **If Tier 2 contradicts Tier 1:** Always defer to the Tier 1 signal but include a note explaining the Tier 2 divergence.

## Output format
The researcher must provide a structured signal report for each investigation:

```json
{
  "signal_tier": 1,
  "source": "538 Polling Average",
  "published_date": "2024-10-15",
  "key_finding": "Candidate A leads Candidate B by 3.2% in state X",
  "probability_direction": "bullish_yes",
  "recommended_p_adjustment": 0.08,
  "confidence": "high",
  "url": "https://abcnews.go.com/538/..."
}
```

## Reference file
For full tier definitions, reliability scores, and base rate tables, read `references/signal-tiers.md`.
