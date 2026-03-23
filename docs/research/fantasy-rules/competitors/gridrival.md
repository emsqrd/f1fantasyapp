# GridRival (gridrival.com)

## Core Product

### Target Audience

Engaged motorsports fans who want more strategic depth than the official F1 Fantasy game offers. GridRival's tagline is "Fantasy Sports for the Racing Obsessed" — it targets players who watch races regularly and want a game that rewards genuine F1 knowledge (mid-field driver performance, contract timing, team dynamics). The mobile-first design and tutorial resources make it accessible to newcomers, but the Contracts mechanic and multi-week planning push it toward strategic players. Not purely for hardcore players: the free-to-enter format and social league features also attract friend groups who want something more interesting than the official game.

### Format Orientation

**Competitive-leaning, but learnable.** The architecture rewards strategic planning across multiple races rather than week-to-week reactivity. The Contracts system, Talent Driver designation, rolling-average improvement points, and transparent salary mechanics all create genuine skill differentiation. However, GridRival deliberately avoids an extreme complexity ceiling — the rule set is learnable and the mobile-first onboarding is designed for first-year fans as well as veterans.

### Core Game Loop

Each race weekend:

1. Review driver salaries and contract status — decide whether to let contracts expire naturally or pay a 3% early release penalty to swap now
2. Sign new drivers/constructors on contracts of 1–5 races, locking salary at signing
3. Designate one **Talent Driver** (low-salary drivers only; earns double points)
4. Lineup locks at start of qualifying — no changes after that
5. Earn points across qualifying, sprint (if applicable), and race
6. Salary table updates post-event based on fantasy rank; bank balance adjusts accordingly (salary increase = cash deposited, salary decrease = cash withdrawn)
7. Plan ahead: sign cheap in-form drivers to long contracts before their salary spikes

### Team Format

| Parameter | Value |
|---|---|
| Driver slots | 5 |
| Constructor slots | 1 |
| Budget cap | $100 million |
| Constructor uniqueness | Only one constructor slot — no duplicates possible |
| Driver overlap | No restriction — any driver combination allowed |
| Contracts | Each element signed to 1–5 race contracts; early release costs 3% of current salary |

### Key Features

**Scoring (2025, assumed unchanged for 2026):**
- Race finish position (higher = more points)
- Sprint race finish position
- Qualifying position (P1–P10 earn points; grid penalties don't affect qualifying points)
- Overtake points (net positions gained between qualifying position and race finish — not grid start — rewards drivers who qualify poorly and charge through)
- Improvement points (earned by finishing above an 8-race rolling average — rewards above-expectation performances and mid-field specialists)
- Beating teammate (flat bonus for finishing ahead of the constructor's other driver)
- Completion points (awarded at 25%, 50%, 75%, and 90% of planned laps — protects against total DNF zeroes)

Constructors earn points based on the top two drivers' race finish and qualifying positions only. Exact negative point values for DNFs/non-qualifications are visible in each league's settings page rather than publicly documented.

**The Contracts System:**
GridRival's most distinctive mechanic. Players sign each driver/constructor to a contract of 1–5 races, locking salary at signing. When a contract expires, that element is unavailable for one race (the "one-race-interval rule") before you can re-sign. Early release costs 3% of the element's current salary. This creates genuine long-term planning: lock a cheap in-form midfield driver for 5 races before their salary rises; avoid locking a top driver who might have a rough patch.

**Talent Driver:**
Each event, designate one driver as your Talent Driver — they earn double points. Only drivers below a salary threshold qualify. Top-salary stars cannot be your Talent Driver, pushing players to identify and invest in well-priced performers.

**No chips:**
GridRival has no chip system (no Wild Card, No Negative, etc.). The Contracts system is the strategic management layer. Rather than periodic get-out-of-jail mechanics, strategy is built into contract timing and salary management.

**Dynamic pricing / salary system:**
Fully transparent, published formula:
1. After each event, all drivers ranked by fantasy points earned
2. Rank maps to a reference salary (rank 1 = $34M → rank 22 = $400K, decreasing ~$1.6M per step; constructors $30M → $4M)
3. Base variation = reference salary − current salary
4. Final adjustment = `ROUND_DOWN(base variation / 4, $100K)`, capped at ±$2M (drivers) or ±$3M (constructors), min move ±$100K
5. New salary = old salary + final adjustment

Salary change affects the player's bank balance directly — salary increases deposit cash, decreases withdraw it. The improvement points system means a midfield driver can gain salary from outperforming their average, not just from raw position.

**Leagues:**
Public and private leagues, in-league chat built into the app, and a "Global Paddock" app-wide community chat. League admins can adjust member points or budgets and remove members — significantly more control than official F1 Fantasy.

### UX/Accessibility

Native iOS and Android app only — gridrival.com is a marketing/download page with no web-based game interface. All team management, league play, and scoring happen in the app. This shows in load times, push notifications (lineup deadline reminders, race start, scoring updates), and navigation.

Getting started is low-friction: free sign-up, $100M budget, guided onboarding. The Contracts mechanic has a learning curve — user reviews commonly mention confusion during the first season, and the platform's support documentation is the main teaching tool rather than in-app tutorials.

## Business & Market

### Monetization

Free to play for the core season-long fantasy league globally — no premium tier or paywalled features for the base game. Monetized via real-money Daily Fantasy / Picks games in the US only (18+, select states). The Picks game offers up to 100× returns on driver performance predictions. This DFS (daily fantasy sports) structure is the primary US revenue model; it is structured separately from gambling classification. International users get the full product at no cost.

### Market Presence

Founded around 2018–2019; raised funding by 2021 when they had drawn over 100,000 users. No current player count is publicly disclosed. Covers multiple series: F1, INDYCAR (official fantasy partner), NASCAR (Cup, Xfinity, Trucks), MotoGP, Formula E. Partners with The Race and WTF1 for public league hosting. App Store rating approximately 4.7/5 stars.

### Positioning

The premium unofficial alternative to Official F1 Fantasy, targeting engaged fans who find the official product shallow or frustrating. Key positioning pillars: deeper strategy (Contracts vs. simple weekly transfers), superior native mobile experience, transparent pricing formula, richer community features (chat, Global Paddock), and broader motorsports coverage. They compete for the same engaged-fan segment as Official F1 Fantasy while positioning above casual web-based alternatives.

### User Sentiment

**What players love:**
- Contracts system creates genuine long-term strategic thinking
- Improvement points mechanic rewards F1 knowledge beyond picking top drivers
- Native app quality — speed, push notifications, offline resilience
- Salary transparency — players can model future price changes ahead of signing
- League admin flexibility and in-league chat
- Customer support responsiveness

**Common complaints:**
- Contracts system poorly explained within the app — new players frequently describe confusion in first season
- No visibility on total league member count, making public league rankings feel meaningless
- Driver exclusivity problem: since any team can pick any driver, competitive lineups converge toward the same best performers by mid-season
- Occasional scoring errors or glitches
- Real-money games not available across all US states

## Assessment

### Strengths

- **Contracts mechanic is genuinely novel.** The most differentiated feature in the F1 fantasy space — rewards long-term planning, creates tension around lock/release timing, and keeps the game engaging through the season
- **Transparent salary formula.** Publishing the exact algorithm is a strong trust signal; players can plan around expected price moves
- **Improvement points and overtake points.** Mid-field driver selection is meaningful and rewards genuine F1 knowledge, not just picking top teams
- **Native mobile app.** Consistently praised in a space where the official product is notoriously poor on mobile
- **League admin controls and in-league chat.** Social game is significantly better than any competitor
- **Multi-series coverage.** INDYCAR official partnership plus NASCAR, MotoGP, etc. positions them as the home for motorsports fans broadly
- **Free to play globally.** Zero friction barrier to entry for the core product

### Weaknesses

- **Onboarding gap.** The contracts system is the core mechanic but is poorly explained in-app — new users churn before they understand it
- **No chips or emergency mechanics.** Players locked into contracts during a driver injury or performance collapse have limited options beyond the costly 3% early release penalty
- **Driver exclusivity problem.** Competitive teams converge toward the same lineups by mid-season since any player can hold any driver
- **US-market monetization dependency.** Real-money layer only works in select US states, limiting revenue from the international audience
- **No published current player count.** Limits network effects for public league discovery and makes the platform's scale hard to evaluate

### Relevance to Us

- **Contracts vs. net-change transfers:** GridRival went deep on long-term contract mechanics; we're leaning toward net-change free transfers per the F1 Fantasy model. These are different strategic philosophies — we don't need to copy GridRival's approach, but understanding what the contracts system achieves (lock-in planning, salary speculation) is useful context if we ever add strategic depth.
- **Pricing transparency:** GridRival's transparent salary formula is a confirmed differentiator in user sentiment. We should publish our algorithm (we've already modeled the SportsDeck formula) — this is a free trust signal. Their formula is documented at https://support.gridrival.com/en/articles/4620071-f1-driver-and-constructor-salaries-advanced and is a useful reference when designing ours.
- **Improvement points / overtake points:** Worth considering when we design scoring. Flat position scoring rewards only top teams; improvement and overtake points make mid-field picks meaningful. Given our friend-group context, this could make the game more interesting for fans who know the field well.
- **Talent Driver mechanic:** The salary-cap eligibility restriction (only lower-priced drivers qualify for double points) forces a real decision — players can't simply double their top star. The constraint is a feature. Worth considering if we add captain/boost mechanics.
- **No chips:** GridRival's explicit choice to skip chips is worth noting. Chips add casual-friendly strategic moments; their absence keeps the game cleaner but removes relief valves. Relevant to our scoring design phase.
- **League admin tools:** Their admin flexibility (point adjustments, removal) and in-league chat are features our friend-group use case would benefit from — and things we can relatively easily build.
- **One constructor slot:** GridRival's single constructor slot makes constructors almost incidental to strategy — an afterthought relative to the five driver slots. Our four constructor slots make constructors central to team-building.
