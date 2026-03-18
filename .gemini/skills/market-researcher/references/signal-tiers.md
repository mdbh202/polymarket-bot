# Signal Tier Reference Guide

This document defines the categorization, reliability weighting, and historical anchoring used by the `market-researcher` skill.

## Signal Tier Definitions

| Category | Tier 1 (Official) | Tier 2 (Established News) | Tier 3 (Expert/Social) | Tier 4 (Speculative) |
| :--- | :--- | :--- | :--- | :--- |
| **Politics** | 538 Polling, Silver Bulletin, FEC Filings, Official Board of Elections, U.S. Census Bureau | Reuters, AP, WSJ, Bloomberg, FT | Twitter Experts (Nate Cohn), Reddit Politics Consensus, Metaculus, PredictIt, Google Trends | Opinion Blogs, Tabloids, Single-Source Tweets, Political Punditry |
| **Economics** | BLS Reports (CPI/Jobs), Fed Statements, FRED Data, IMF Forecasts, BEA Reports | FT, Bloomberg Economics, WSJ Business, Reuters Finance, AP Business | Twitter Economists, Substack Economists, Metaculus Econ, CME FedWatch, Retail Sentiment | General Financial Blogs, TV News Segments, Crypto Influencers |
| **Crypto** | Ethereum Foundation EIPs, SEC/CFTC Filings, Developer Repos (GitHub), Bitcoin Core, CoinMarketCap | The Block, CoinDesk, Messari Research, Cointelegraph, Bloomberg Crypto | Twitter Developers, Reddit r/CryptoCurrency, Glassnode, Nansen, Crypto Community | Telegram Signals, TikTok Influencers, Anonymized 4chan Leaks |
| **Sports** | Official League Standings (NBA/NFL), ESPN Statistics, Official UFC Results, Sports-Reference, Olympic Official Feed | The Athletic, Bleacher Report, CBS Sports, Sports Illustrated, Sky Sports | Twitter Insiders (Shams/Woj), FiveThirtyEight Sports, Metaculus Sports, Betting Markets, Reddit r/Sports | Fan Forums, Betting Advice Blogs, Celebrity Tweets, Rumor Mills |
| **Science** | Nature, Science (AAAS), NASA Mission Pages, Pew Research, CDC/WHO Official Reports | Scientific American, NYT Science, National Geographic, New Scientist, Ars Technica | Twitter Science Community, Reddit r/Science, Metaculus Science, Academic Preprints (arXiv), Manifold Markets | Health Blogs, Pop-Science Tabloids, Opinion Pieces, Documentary Trailers |

## Source Reliability Scores

| Source Type | Reliability (0-10) | Latency | Usage Notes |
| :--- | :---: | :--- | :--- |
| **Official Gov/Reg Statement** | 9 | Low (Official Release) | Gold standard for truth. No-trade if Tier 1 signals conflict. |
| **Wire Services (AP/Reuters)** | 8 | Very Low (Real-time) | Best for immediate fact-based reporting. High trust. |
| **Major Financials (FT/Bloomberg)** | 7 | Low (Fast Analysis) | High trust for economic and financial implications. |
| **Metaculus Community** | 7 | High (Consensus) | Strong signal ONLY if forecaster_count > 50. |
| **Kalshi Market Price** | 7 | Very Low (Market) | Excellent comparison for US-based events. |
| **Major Newspapers (NYT/WSJ)** | 6 | Medium (Daily) | Use for deep reporting. Avoid opinion sections. |
| **Twitter Verified Account** | 5 | Very Low (Instant) | Best for immediate news-lag exploitation. Verify domain. |
| **Academic Preprint (arXiv)** | 5 | Very High (Weeks) | Good for long-term trends. Use with caution for resolution. |
| **Reddit Consensus** | 3 | High (Discussion) | Use for sentiment and "wisdom of the crowd" only. |
| **Google Trends** | 3 | Low (Search) | Proxy for retail interest and "frenzy" levels. |
| **Punditry/Opinion Blogs** | 2 | High (Narrative) | Avoid using as a probability factor. |

## Recency Decay Table

Signals must be discounted based on their age relative to the event type.

- **Politics:** Signals older than 7 days lose 30% weight per additional week. A poll from 3 weeks ago is discounted by ~60%.
- **Economics:** Signals older than 24 hours lose 50% weight per day. Economic data moves the market instantly upon release.
- **Crypto:** Signals older than 4 hours lose 50% weight per hour. News cycles in crypto are exceptionally fast.
- **Sports:** Signals older than 24 hours lose 70% weight per day (e.g., pre-game injury vs. game-time status).
- **Science:** Signals older than 30 days lose 10% weight per month. Long-term scientific studies remain relevant for months.

## Base Rate Reference Tables

### US Politics (FairVote, 1956-2024)
- Presidential incumbents seeking re-election: **67% win rate**.
- Senate incumbents seeking re-election: **85% win rate**.
- House incumbents seeking re-election: **94% win rate**.

### Economics (Fed FRED, 2000-2024)
- Fed Rate changes at scheduled meetings: **28% historical frequency**.
- Recession in any given calendar year (US): **~15% historical frequency**.

### Crypto & Tech (2015-2024)
- Major network upgrade/milestone reached on the stated date: **35% historical frequency** (65% delay rate).
- Crypto projects reaching top 10 market cap and staying for 1 year: **15% base rate**.

### Sports & Legal (2000-2024)
- Major league champion defending title (NBA/NFL/MLB): **~18% base rate**.
- Supreme Court reversal rate (cases accepted for review): **~70%**.
- UFC Champion defending title successfully: **~62%**.
- FDA Drug Approval (Phase III to Approval): **~58%**.

### Forecasting Platform Interpretation
- **Metaculus:** The "Community Prediction" is the aggregate of human forecasters. The "Metaculus Model" is AI-weighted. Prioritize Community Prediction if the count > 50.
- **Manifold:** Requires >$500 volume in MANA-equivalent liquidity to be considered a Tier 2 signal.
- **Kalshi:** If Kalshi price differs from Polymarket by >5% on a US-regulated event, investigate the market with the highest Open Interest. The more liquid market usually has the "truer" price.
