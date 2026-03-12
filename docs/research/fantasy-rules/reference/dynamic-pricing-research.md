# Dynamic Pricing Research: How Fantasy Sports Platforms Change Prices

**Date:** 2026-03-05
**Purpose:** Understand the actual mechanisms that major fantasy platforms use for in-season price changes, to inform our own dynamic pricing decisions.

---

## Summary of Approaches

| Platform | Pricing Driver | Frequency | Automated? | Caps on Movement |
|---|---|---|---|---|
| **F1 Fantasy (official)** | Performance (PPM) | After each race | Fully automated | Step-change tiers (max ~$0.6M/race) |
| **FPL (Fantasy Premier League)** | Transfer activity (demand) | Daily | Automated + manual override | +/- 0.1m/day, ~0.3m/gameweek |
| **DraftKings / FanDuel** | Performance + demand + matchup | Weekly (per slate) | Algorithm + manual overrides | Full re-price each week (no incremental) |
| **NBA Fantasy Salary Cap** | Ownership/demand | Weekly | Automated | Not documented |
| **Dream11** | ML model (form + popularity) | Per match/contest | Fully automated | Fixed per contest, changes between contests |

---

## 1. F1 Fantasy (Official) — Performance-Based Step Changes

### The Algorithm (Reverse-Engineered by Community)

The F1 Fantasy pricing algorithm was cracked by the [F1 Fantasy Tools](https://f1fantasytools.com/) community in 2025. It is **purely performance-driven** — transfer/ownership activity plays no role.

**Core formula:**
```
AvgPPM = (Score_race_N + Score_race_N-1 + Score_race_N-2) / 3 / CurrentPrice
```

The average Points Per Million (PPM) over the last 3 races determines which of 4 performance buckets the asset falls into.

### Two-Tier System

Assets are split into two tiers with different price change amounts:

| | Tier A (>$18.5M) | Tier B (<$18.5M) |
|---|---|---|
| **Great** | +$0.3M | +$0.6M |
| **Good** | +$0.1M | +$0.2M |
| **Poor** | -$0.1M | -$0.2M |
| **Terrible** | -$0.3M | -$0.6M |

**Key design choice:** B-tier assets (cheaper drivers/constructors) move faster in both directions. This helps underpriced assets catch up quickly and overpriced ones correct faster.

### PPM Thresholds (2025, Final)

The thresholds defining each bucket evolved during the 2025 season but settled at:

| Boundary | AvgPPM Threshold |
|---|---|
| Great/Good | 1.2 |
| Good/Poor | 0.9 |
| Poor/Terrible | 0.6 |

If AvgPPM >= 1.2: Great. If >= 0.9: Good. If >= 0.6: Poor. Below 0.6: Terrible.

### The "Dummy Races" Bootstrap

For the first two races of the season, there aren't three races of history. The developers solve this by creating two invisible "dummy races" (RW0 and RW-1) where each asset's score equals their starting price. This means all assets start at PPM = 1.0 for those dummy races, so:
- Race 1 AvgPPM = (DummyScore + DummyScore + Race1Score) / 3 / Price
- This dampens the effect of a single outlier race early in the season.

### Budget Cap Adjustment

When an asset's price changes, the budget cap for teams that own that asset adjusts by the same amount. If NOR gains $0.3M, teams with NOR get a cap increase from $100M to $100.3M. This is a crucial mechanic — it means price rises don't strand you with an illegal roster.

### Historical Evolution

| Season | Mechanism | Frequency |
|---|---|---|
| 2020-2021 | Supply/demand (transfer activity) | **Every hour** |
| 2023 | Unknown, likely performance | Once per race week |
| 2024 | Performance-based (single race lookback) | After each race |
| 2025-2026 | Performance-based (3-race rolling PPM) | After each race |

The shift from hourly supply/demand to post-race performance was a major philosophical change. The 2024 single-race lookback caused massive price swings, prompting the 3-race rolling average in 2025.

### Key Takeaways for F1 Fantasy

- **Purely performance-driven** — no demand/transfer signal at all
- **Deterministic** — given scores and current prices, the price change is exactly predictable
- **Smoothed** — 3-race rolling average prevents one-off results from causing big swings
- **Tier-differentiated** — cheaper assets move faster, helping market equilibrium
- **Transparent in retrospect** — the community fully reverse-engineered it

Sources:
- [F1 Fantasy Tools Patreon — 2025 Algorithm Discovery](https://www.patreon.com/posts/potential-new-124351728)
- [F1 Fantasy Tools Patreon — Algorithm Updates](https://www.patreon.com/posts/updates-to-2025-125291547)
- [Formula Fantasy Hub — 2025 Changes Summary](https://x.com/F_FantasyHub/status/1899419371187077534)
- [FanAmp — F1 Fantasy Cost Caps Explained](https://www.fanamp.com/articles/f1-fantasy-cost-caps-explained)
- [F1 Fantasy Tools Budget Builder](https://f1fantasytools.com/budget-builder)
- [F1 Fantasy Official — Dynamic Pricing Page](https://fantasy.formula1.com/dynamic-pricing)

---

## 2. Fantasy Premier League (FPL) — Transfer-Activity Driven

### The Mechanism

FPL is the gold standard for **demand-driven pricing**. Prices change based on how many managers are buying/selling a player, not based on on-pitch performance directly. Performance influences prices only indirectly (because good performances cause transfers in).

### How It Works (Reverse-Engineered)

Based on extensive community research (notably the [FPL Core "Cracking the Algorithm" series](https://www.fplcore.com/blog/the-rabbit-hole-cracking-the-fpl-price-algorithm-part-1-of-7), analyzing 720,000+ player-days of data):

**Two conditions must BOTH be met for a price rise:**

1. **Cumulative net transfer pressure crosses a fixed threshold (~200,000-240,000)**
   - Net transfers = transfers in minus transfers out
   - The counter resets to zero after each price change
   - The threshold is the same for all players regardless of price or ownership

2. **Daily net transfers exceed roughly 30,000-60,000**
   - This represents active current demand
   - Massive cumulative pressure from last week but only 5,000 transfers today = no rise

**Escalating multipliers for consecutive rises within a gameweek:**
- First rise: base threshold (~200-240k net transfers)
- Second rise: 2x threshold (~400-480k additional)
- Third rise: 3x threshold (~600-720k additional)
- Multipliers reset after the gameweek deadline

### Price Falls Work Differently

Falls have a different threshold: the lower of either:
1. The negative of the NTI threshold (for players who've risen during the season)
2. 10% of current ownership (for players at or below season starting price)

There is **no multiplier on falls** — a player can drop faster than they rise if heavily sold.

### Important Details

**How transfers are counted:** The algorithm counts unique managers per day, not raw transfers. A wildcard manager making 15 transfers counts the same as a normal manager making one. This significantly dampens price volatility during wildcard-heavy weeks.

**Ownership floor:** Zero rises occur below ~1% ownership, even with high net transfer numbers. This prevents obscure players from spiking on tiny volumes.

**Red-flag protection:** Injured/flagged players get a 2-3x threshold multiplier, and gain 8 days of price protection when the flag clears.

**Selling price spread:** Managers only receive 0.1m profit for every 0.2m a player appreciates. This creates a buy/sell spread that discourages pure speculation and means early adopters capture more value.

**Movement caps:**
- Maximum +/- 0.1m per day
- Roughly +/- 0.3m per gameweek (practical maximum)

**Manual intervention:** FPL has the ability to manually override prices, though they rarely acknowledge doing so. The exact algorithm has never been published and changes between seasons.

### Key Takeaways for FPL

- **Demand-driven, not performance-driven** — performance is only an indirect signal
- **Self-correcting market** — popular players get expensive, unpopular ones get cheap
- **Creates a speculation metagame** — managers transfer early to "catch" price rises
- **Opaque by design** — FPL has never published the algorithm; the community approximates it
- **Daily volatility** — prices can change every night, creating urgency
- **Spread mechanic** rewards conviction (buying early, holding through rises)

Sources:
- [FPL Core — Part 1: The Rabbit Hole](https://www.fplcore.com/blog/the-rabbit-hole-cracking-the-fpl-price-algorithm-part-1-of-7)
- [FPL Core — Part 3: One Threshold to Rule Them All](https://www.fplcore.com/blog/one-threshold-to-rule-them-all-cracking-the-fpl-price-algorithm-part-3-of-7)
- [FISO — The Guide to FPL Price Changes](https://www.fiso.co.uk/forum/viewtopic.php?t=128052)
- [Premier League Official — FPL Price Changes Explained](https://www.premierleague.com/en/news/2858775)
- [LiveFPL — Price Changes](https://www.livefpl.net/prices)

---

## 3. DraftKings / FanDuel (DFS) — Algorithm + Manual Hybrid

### How Salaries Are Set

Daily fantasy sports (DFS) platforms like DraftKings and FanDuel don't have "price changes" in the traditional sense — they **re-price every player from scratch** for each contest slate (usually weekly for NFL, daily for NBA/MLB).

### The Core Algorithm

~99% of player prices are algorithm-driven. The main inputs:

1. **Weighted average of recent fantasy points per game**
   - More recent games count more heavily (recency weighting / decay)
   - At season start, based on prior season stats
   - As season progresses, current-season data increasingly dominates

2. **Previous ownership percentage**
   - If a player was played in a large % of lineups, price adjusts upward
   - If underused, price adjusts downward
   - This is a demand signal similar to FPL but applied weekly

3. **Matchup/opponent (DFS-specific)**
   - Defense vs. Position (DVP) ratings
   - A player facing a weak defense gets a salary bump

### FanDuel's Specific Approach

FanDuel has disclosed more about their methodology than most:
- Uses a **weighted average** of points per game with a **decay rate** that varies by sport and position
- For baseball hitters: low decay rate (recent and historical weighted similarly)
- For other sports/positions: higher decay (recent performance matters more)
- Has the ability to **manually adjust baseline prices** for players with role changes
- Philosophy: pricing reflects **predicted contestant preference**, not just expected performance

### DraftKings vs. FanDuel Differences

- **DraftKings** is more reactive — salaries dip more for injuries or bad streaks
- **FanDuel** is more stable/accurate — less erroneous but potentially slower to react
- DraftKings resets salary data on Sunday nights (NFL)

### Key Takeaways for DFS

- **Full weekly re-pricing** — no incremental changes, complete reset each slate
- **Hybrid automated/manual** — algorithm sets 99%, editors fix edge cases (role changes, injuries)
- **Demand is a first-class input** — ownership data directly influences next week's prices
- **Sport-specific tuning** — decay rates vary by sport and position
- **Not transparent** — no platform publishes its exact formula

Sources:
- [Daily Fantasy Winners — How DFS Pricing Algorithms Work](https://dailyfantasywinners.com/fantasy-categories/featured/daily-fantasy-football-pricing-algorithms-work)
- [Daily Fantasy Winners — FanDuel vs DraftKings Algorithms](https://dailyfantasywinners.com/fantasy-categories/featured/fanduel-vs-draftkings-pricing-algorithm)
- [RotoGrinders — Behind FanDuel's Salary Cap](https://rotogrinders.com/articles/behind-fanduel-s-salary-cap-956)

---

## 4. NBA Fantasy Salary Cap Edition — Pure Demand

### How It Works

The NBA's official salary cap fantasy game uses a simple demand-based model:
- Players selected more frequently become more expensive
- Players selected less frequently become more affordable
- $100M salary cap for a 10-player roster
- Salaries fluctuate throughout the season

This is the simplest model of any major platform — essentially a pure supply/demand price discovery mechanism with no documented performance component.

Sources:
- [NBA Fantasy Salary Cap Edition — How to Play](https://www.nba.com/news/nba-fantasy-salary-cap-edition-how-to-play)
- [NBA Fantasy Salary Cap Edition — 2025-26 Updates](https://www.nba.com/news/nba-fantasy-salary-cap-edition-updates-for-the-2025-26-season)

---

## 5. Dream11 (Cricket/Multi-Sport) — Machine Learning

### How It Works

Dream11 is notable for being the most technically sophisticated public example. They've published details of their approach:

- **XGBoost model** trained on historical match data
- Inputs: player form, consistency, and popularity
- Outputs a score per player that maps to one of ~10 credit buckets
- Prices are **fixed for each individual contest** but change between contests as form evolves
- The model handles non-linearity well (e.g., a player's value depends on match context, not just raw averages)

### Key Details

- Credits (their term for price) are locked once a contest opens
- No mid-contest price fluctuation
- Between contests, the ML model re-evaluates based on latest performance
- Form + popularity both factor in — a popular player who underperforms will still be somewhat expensive due to demand

Sources:
- [Dream11 Tech Blog — Player Pricing](https://tech.dream11.in/blog/player-pricing)
- [Dream11 Help — Do Credits Change?](https://get.dream11.help/hc/en-us/articles/360021387991)

---

## 6. Sportsdeck F1

### What We Know

Sportsdeck's pricing methodology is **not publicly documented**. What we can observe:

- 2025 preseason: ANT priced at $12.5M (rookie in Mercedes), BOR at $3M floor
- This implies team context/editorial judgment influences preseason pricing
- Their in-season price change mechanism is unknown
- They have a $120M budget cap with 4D + 4C format

No public documentation, blog posts, or community reverse-engineering of their algorithm was found.

---

## Analysis: Three Distinct Philosophies

### Philosophy A: Performance-Driven (F1 Fantasy)
- **Input:** On-track results (points scored)
- **Pros:** Deterministic, fair, rewards actual F1 knowledge
- **Cons:** Doesn't create transfer urgency, no speculation metagame
- **Best for:** Platforms where the "game" is about predicting race performance

### Philosophy B: Demand-Driven (FPL, NBA Fantasy)
- **Input:** Manager transfer activity / ownership
- **Pros:** Creates a market, adds a speculation layer, self-correcting
- **Cons:** Rewards transfer gaming over F1 knowledge, needs large player base for signal
- **Best for:** Platforms with millions of players (statistical significance for demand signals)

### Philosophy C: Hybrid Re-Pricing (DraftKings, FanDuel, Dream11)
- **Input:** Performance + demand + context (matchups, role changes)
- **Pros:** Most accurate, can handle edge cases
- **Cons:** Requires manual oversight, opaque, not fully reproducible
- **Best for:** Commercial platforms with dedicated pricing teams

---

## Implications for Our App

### Why Demand-Driven Won't Work for Us
Our app targets a small friend group (~10-15 players). Demand-driven pricing requires statistical significance — FPL needs ~200,000 net transfers to trigger a 0.1m change. With 10 managers, transfer signals would be meaningless noise.

### Performance-Driven is the Natural Fit
F1 Fantasy's approach (PPM-based step changes) aligns well with our constraints:
- Works with any number of managers (doesn't depend on transfer volume)
- Deterministic and transparent (we've committed to publishing our formula)
- Rewards F1 knowledge, not transfer gaming
- Already partially built (our `compute_price_change()` function exists)

### Specific Design Elements Worth Adopting

1. **Tiered step changes** — Cheaper assets should move faster (F1 Fantasy's Tier A/B system). This helps the market self-correct and makes budget-building more strategic.

2. **Rolling average window** — F1 Fantasy's 3-race rolling PPM prevents single-race flukes from causing wild swings. Given our scoring scale, 3 races seems like the right window.

3. **Dummy race bootstrap** — F1 Fantasy's approach of creating synthetic history for the first 1-2 races is elegant. Without it, a single outlier in Race 1 could cause huge swings.

4. **Budget cap adjustment** — When a player's price changes, the team's cap should adjust proportionally. This prevents price rises from creating illegal rosters.

5. **FanDuel's editorial override capability** — Even with a formula-driven system, having the ability to manually adjust a player's price (e.g., for a mid-season team change) is valuable. FanDuel builds this in explicitly.

### What This Means for the Open Pricing Questions

This research supports **Option A or B** from `pricing-model-open-questions.md`:
- **Preseason pricing** remains the harder problem (editorial vs. formula — this research doesn't resolve it)
- **In-season dynamic pricing** should be performance-driven with a rolling average, similar to F1 Fantasy's approach
- The 3-race rolling window and tiered step changes are proven patterns we should adopt
- Our existing dynamic pricing code is already on the right track; the main improvements would be adding tier differentiation and the rolling average window
