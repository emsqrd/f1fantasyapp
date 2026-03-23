# Official F1 Fantasy (fantasy.formula1.com)

## Core Product

### Target Audience

Primarily emerging and younger fans rather than hardened veterans. 2024 demographics: 77% of players were under 35, 46% in the 16–24 bracket, 25% female (up 24% from 2023). The game is a strategic fan-engagement tool for Liberty Media — it converts casual viewers (Drive to Survive audience, social-media fans) into year-round invested followers. Accessible enough for a first-year fan, deep enough (chips, transfer timing, price strategy) to retain experienced players.

### Format Orientation

**Casual-first with competitive layers.** The core mechanics are designed to be low-friction: team building is simple, the DRS Boost costs nothing to adjust, and two free transfers per race is generous enough that casual players rarely feel punished. You can set a team and largely leave it alone.

The competitive depth exists for those who seek it — chip timing, price trajectory management, and transfer optimization separate top players from casual ones. But that depth is opt-in, not required. The Global League has real prizes, but the vast majority of players compete in private friend/family leagues where the social element matters more than rankings.

In short: **casual by design, competitive by choice.**

### Core Game Loop

Each race weekend:

1. Before qualifying: make up to 2 free transfers to reshape the squad
2. Designate one driver for the **DRS Boost** (2× points for the full weekend, free to change each race)
3. Optionally activate one of your six one-time seasonal **chips**
4. Earn points live during qualifying, sprint (if applicable), and the race
5. Check standings in the Global League and private mini-leagues
6. React to post-race price changes ahead of the next event

### Team Format

| Parameter              | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Driver slots           | 5                                                                             |
| Constructor slots      | 2                                                                             |
| Budget cap             | $100 million                                                                  |
| Constructor uniqueness | Both must be different (no duplicates)                                        |
| Driver overlap         | No restriction — both drivers from the same real team are allowed             |
| Teams per account      | Up to 3 (all three eligible for Global League prizes; max 1 prize per player) |

### Key Features

#### Scoring

**Scoring:**

- Qualifying: 1st = 10 pts → 10th = 1 pt; no-time = −5; DSQ = −5 (constructor)
- Race: mirrors F1 points scale (25/18/15…1) + position-gained/lost (+/−1 per), overtakes (+1 each), fastest lap (+10), Driver of the Day (+10), DNF (−20)
- Sprint: top 8 scored (8/7/6/5/4/3/2/1), fastest lap (+5), DNF (−10)
- Constructors: qualifying bonuses (−1 → +10 based on Q2/Q3 driver counts) + pit stop scoring (under 2.0s = 20 pts, fastest pit of race = +5 bonus)
- DSQ penalties applied to constructor, not driver

**DRS Boost:** One driver doubles their total weekend score. Change target freely each race at no cost. Negative totals are also doubled.

**Six seasonal chips (one-time each):**

| Chip            | Effect                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Extra DRS Boost | 3× one driver's points (different driver than your standard DRS)                                     |
| Autopilot       | Auto-applies 2× to highest-scoring driver — good for unpredictable weekends                          |
| No Negative     | Floor of zero — no negative scoring categories count                                                 |
| Wildcard        | Unlimited transfers within $100M budget cap for one race                                             |
| Limitless       | Unlimited transfers with no budget cap for one race (banked transfers forfeited)                     |
| Final Fix       | One transfer swap after qualifying, before race — qualifying points from swapped-out driver are kept |

No Negative, Autopilot, and Extra DRS Boost available from race 1; Wildcard, Limitless, and Final Fix unlock after the first race weekend.

**Transfer rules:** 2 free transfers per race, bank up to 3. Extra transfers cost −10 pts each. Transfers are counted on a net-change basis — only the final lineup delta counts, so swapping back and forth before the deadline costs nothing.

#### Pricing

Prices update after each race based on the previous 3 Grand Prix. Price floor is $3M.

The pricing algorithm is not published by F1 Fantasy. The details below are reverse-engineered findings from [F1 Fantasy Tools](https://f1fantasytools.com) (March 2025 Patreon article), based on observed data from the first two races of the 2025 season. These are best-guess assumptions, not confirmed mechanics.

_Price tiers:_ Two tiers based on current price:

- **A-Tier** (≥$19M): smaller price movements
- **B-Tier** (<$19M): larger price movements

_Performance classification:_ Each entity's average points per million (AvgPPM) over the rolling 3-race window determines its performance category. AvgPPM = rolling average score ÷ (price in millions). The neutral point is 0.9 PPM — above it prices rise, below it prices fall.

| AvgPPM    | Performance | A-Tier change | B-Tier change |
| --------- | ----------- | ------------- | ------------- |
| > 1.2     | Great       | +$0.3M        | +$0.6M        |
| 0.9 – 1.2 | Good        | +$0.1M        | +$0.2M        |
| 0.6 – 0.9 | Poor        | −$0.1M        | −$0.2M        |
| < 0.6     | Terrible    | −$0.3M        | −$0.6M        |

_Key characteristics:_

- **Fixed dollar movements, not percentages.** A $25M constructor moves the same $0.3M as a $19M one. No compounding — the step size never grows as the price rises.
- **Expensive entities move less.** A-Tier max change is ±$0.3M; B-Tier max is ±$0.6M. This naturally limits how fast top entities approach any price ceiling.
- **PPM ties performance to price.** The same score is evaluated differently at different price points — 20 points at $20M (1.0 PPM, "Good") vs 20 points at $10M (2.0 PPM, "Great"). The current price is part of the performance evaluation.
- **Non-weighted rolling average.** All 3 races in the window are equally weighted. F1 Fantasy Tools identifies this as a flaw — it means 66% of the price signal comes from what already happened, not what's about to happen.

_Known structural issues (from F1 Fantasy Tools' 2024 simulation):_

- **B-Tier drivers systematically lose value.** Average B-Tier driver PPM in 2024 was 0.388 — permanently below the 0.6 "Terrible" threshold. These drivers lose $0.6M nearly every round regardless of relative performance within their tier.
- **A-Tier constructors systematically gain value.** Average A-Tier constructor PPM was 2.310 — permanently above 1.2 "Great." A-Tier constructors gained +$0.3M in 90 of 96 round-changes (94%).
- **Binary outcomes dominate.** 71% of price changes fell in either "Great" or "Terrible" — the middle categories (Good/Poor) rarely trigger, making the system effectively binary (+max or −max).
- **Streak behaviour.** Gaining and losing streaks are common — once an entity starts gaining, it tends to continue for several consecutive rounds before reversing. This creates predictable wave patterns that informed players can exploit.

**Leagues:** Global League (season-long, all players), public leagues, private mini-leagues, head-to-head weekly matchups. Per-race prizes (£100 F1 Store voucher for top weekly team) and season prizes (grandstand tickets + VIP experience to a future GP).

### UX/Accessibility

Web at fantasy.formula1.com + embedded in the official F1 app (iOS/Android) — not a standalone fantasy app. Free F1 account required (quick signup). Team can be built in under 10 minutes. PWA install supported for mobile home screen shortcuts.

## Business & Market

### Monetization

100% free to play. No premium tier, no in-app purchases, no pay-to-win mechanics. Monetization is indirect: F1 Fantasy drives app installs, session time, and funnels fans toward F1 TV subscriptions, merchandise, ticket sales, and sponsor exposure. It is a fan-retention product for Liberty Media, not a standalone revenue stream.

### Market Presence

1.5 million registered players in 2024 (confirmed by Formula One World Championship Limited). Embedded in the official F1 app and directly tied to the F1 brand and broadcast calendar. Established, with a growing user base skewing younger.

### Positioning

The only officially licensed F1 fantasy product. Has real-time official data, F1 brand integration, and is embedded in the ecosystem fans already use. Positioned as an engagement and retention tool, not purely a game. No third-party competitor can match the "official" data and brand advantage.

### User Sentiment

**What people love:**

- DRS Boost flexibility (free to change weekly, low friction)
- Chips system adds season-long strategic depth
- Live/provisional scoring during races
- Official integration with real F1 data and calendar

**Common complaints:**

- UX navigation: home screen is cluttered, too many taps to reach key views
- DNF penalty severity (−20 for race) can wipe out a strong weekend
- Poor communication around mid-season driver changes
- Technical bugs: teams appearing blank, failed team submissions, login state flickering
- Head-to-Head mode: same opponent paired every week, feels stale
- Can't see other members of public leagues you've joined
- Pricing algorithm is not transparent — no visibility into how prices are calculated

## Assessment

### Strengths

- Official F1 data and brand — unmatched credibility and real-time accuracy
- 1.5M+ players gives it the largest community and most competitive leagues
- Chip system is well-designed — deep strategy without being overwhelming
- DRS Boost is clever: high-impact, free to adjust, widely understood
- Free to play with no paywalls — zero friction barrier
- Directly embedded in the F1 app millions already use

### Weaknesses

- UX is cluttered and confusing for new users
- Race DNF penalty (−20) is still harsh and contentious
- No public visibility into league membership — social features feel thin
- Head-to-Head matchmaking is poor (same opponent weekly)
- Opaque pricing algorithm frustrates strategically-minded players
- Lives inside the F1 app — the fantasy layer is a tab, not a first-class product

### Relevance to Us

- **Scoring system:** A strong reference baseline. Their qualifying + race + sprint scoring (including pit stops) is well-tested and community-accepted. Worth adapting as a foundation.
- **DRS Boost / chips:** Not something we need to copy immediately, but understanding what makes them compelling is useful as we think about differentiation.
- **Pricing transparency:** They get criticized for opacity. Being open about our algorithm is a real differentiator — players appreciate knowing how prices will move.
- **DNF penalties:** The race DNF at −20 is contentious — calibrate carefully if we implement scoring.
- **Net-change transfers:** We want to adopt this — lets players explore options without fear of accidentally burning a transfer. Should be a firm requirement when we implement the transfer system, not an afterthought.
- **League UX gaps:** Visible league membership and better H2H rotation are unmet needs — open opportunity.
- **Team format difference:** They use 5 drivers + 2 constructors; we use 5 drivers + 3 constructors. Our extra constructor slot gives constructors more weight — a meaningful differentiation.
