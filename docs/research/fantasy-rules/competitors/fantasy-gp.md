# Fantasy GP (fantasygp.com)

## Core Product

### Target Audience

Casual-to-engaged F1 fans who want to deepen their enjoyment of watching races. Fantasy GP's own framing: "makes even the dullest race much more interesting" and "makes watching races even more fun." They position the game as something to play against friends, family, and "that colleague who thinks they know everything about F1." There is an educational angle — the game encourages learning about midfield drivers and backmarkers, suggesting an intent to deepen engagement for fans who are still learning the field.

Not targeting esports-competitive players. The ~12,000 active player count (2025 World Championship) is small by industry standards — a loyal, niche community rather than a mass-market product. Operated by a three-person team (Le Feuvre Media Ltd), which limits how aggressively they can court growth.

### Format Orientation

**Firmly casual, with light strategic depth.** The team format (3 drivers + 3 constructors) is the simplest in the market. No chips, no seasonal contracts, no complex transfer math. The strategic surface is primarily budget management and predicting driver price trajectories.

The real differentiator is the predictions layer — a second scoring track that rewards race-watching knowledge rather than just team construction. This shifts the game toward fan engagement over analytics. Even a player with a poor team can have a strong race weekend by nailing predictions, which preserves enjoyment and reduces churn from unlucky results.

The PRO budget boost (+$5M) introduces a mild pay-to-win element, but at £9.99/season the barrier is low enough that it doesn't fundamentally divide the user base.

### Core Game Loop

Each race weekend:

1. Review team and decide whether to use any of your seasonal transfer allowance (6 free for Rookie; 40 free for PRO)
2. Submit race predictions: pole position, podium (top 3 drivers with positions), fastest lap, number of safety car periods, and a themed bonus question
3. Team locks before qualifying; no changes after that
4. Earn points: team scoring (race finish + position gains + constructor bonuses) + prediction scoring
5. Check global World Championship standings and private league standings
6. Monitor driver/constructor price changes and plan transfers for upcoming races

PRO Elite members see live scoring updated every few laps during the race itself.

### Team Format

| Parameter | Value |
|---|---|
| Driver slots | 3 |
| Constructor slots | 3 |
| Budget cap | $75 million (Fantasy GP Dollars) |
| PRO budget boost | +$5M for PRO Elite subscribers only |
| Constructor uniqueness | No documented restriction |
| Driver overlap | No documented restriction |

The $75M cap across a 3+3 roster creates tight per-slot budget pressure — value picks and roster construction are central to the strategy.

### Key Features

**Scoring (2025, no changes documented for 2026):**

Drivers — race finish:
- 1st: 25 pts, 2nd: 18, 3rd: 15, 4th: 12, 5th: 10, 6th: 8, 7th: 6, 8th: 4, 9th: 2, 10th: 1
- Position gain from race start: +2 per place
- Pole position: +10
- Beat teammate in qualifying: +5
- Beat teammate in race: +5

Constructors — race:
- Mirrors F1 championship points for their drivers (1st=25 through 10th=1)
- Position gain from Sunday start: +1 per place
- One car finishes: +2 bonus; both cars finish: +5 bonus

Sprint races: Points awarded for 1st–8th finishes; position gain bonuses (+2/place for drivers, +1/place for constructors) also apply. Completion bonuses same as race.

Predictions (per correct answer):
- Pole position: 10 pts
- Podium — correct driver, correct position: 10 pts
- Podium — correct driver, wrong position: 5 pts
- Fastest lap: 10 pts
- Safety car periods (correct count): 10 pts
- Themed bonus question: 10 pts
- Super Combo Bonus (all correct): +15 pts extra

**Transfer rules:**
- Rookie (free): 6 free changes for the entire season; 10 pts penalty per additional change
- PRO: 40 free changes for the entire season; 10 pts penalty per additional change
- Early-season setup window allows unlimited changes before the second race lock

**Dynamic pricing:** Driver and constructor prices fluctuate throughout the season based on performance. Buying undervalued assets before they peak is an explicit strategic lever.

**No chips:** No Wild Card, Limitless, Triple Captain, or equivalent mechanics. The predictions layer is the primary engagement differentiator.

**Leagues:** Create unlimited private mini-leagues (PRO; Rookie tier has limits). Global World Championship is the main public competition. Players can compete against named F1 media personalities (e.g., BBC's Jennie Gow).

### UX/Accessibility

Web-only. Native iOS and Android apps existed until end-of-2017 season — discontinued to focus development resources on the web game. fantasygp.com is a mobile-responsive website; players can "Add to Home Screen" on iOS/Android for an app-like shortcut.

Sessions persist for 3 weeks without re-login. PRO Elite members see live scoring updated every few laps during a race. Free tier is ad-supported; £2.99 Supporter tier removes ads only.

Sign-up and first-team setup is described as fast and low-friction. No native push notifications for race deadlines or score updates — a meaningful UX gap in a sport where lock deadlines are time-sensitive.

## Business & Market

### Monetization

Three-tier model (2026 pricing confirmed):

| Tier | Price | Key differentiators |
|---|---|---|
| Rookie (Free) | £0 | Full game access, ad-supported, 6 seasonal changes |
| Supporter | £2.99/season | Ad-free only, no other PRO features |
| PRO Elite | £9.99/season | +$5M budget, 40 seasonal changes, live scoring, stats back to 2020, unlimited mini-leagues, default predictions, team spy, prize eligibility |

PRO Championship awards prizes per race winner — historically F1-themed merchandise (Lego sets, race helmets, team gear) tailored to winners' preferences.

Operated by Le Feuvre Media Ltd (Yorkshire/London). The PRO price at £9.99/season is very low by market standards; the business model appears designed to sustain the platform rather than generate significant revenue. No external funding disclosed — bootstrapped.

### Market Presence

- **Founded:** 2008 (as BadgerGP.com); became independent in 2017 as fantasygp.com
- **Operator:** Le Feuvre Media Ltd — three people: Adam, Ben, and Dave
- **Player history:** 500 (2009) → 8,000+ (2016) → 20,000+ (2018) → ~12,000 active (2025)
- **2025 season:** 17th World Championship
- **Funding:** Bootstrapped; no known external investment
- **Partnerships:** No disclosed F1, team, or media partnerships
- **Self-described position:** "The number 1 independent Fantasy F1 game" (claim made on their own site)

The decline from 20,000 (2018) to ~12,000 (2025) likely reflects increased competition from larger, better-resourced platforms that have grown substantially since 2018.

### Positioning

Fantasy GP positions itself as the accessible, fan-run alternative to the officially licensed platforms:

**vs. Official F1 Fantasy:** Simpler format (3+3 vs. 5+2), predictions mechanic as a second scoring layer, independent "by F1 fans, for F1 fans" identity, no chips complexity, tighter budget cap creating sharper trade-offs.

**vs. GridRival:** Season-long game vs. GridRival's contract-based system, web-only vs. native mobile, simpler mechanics with no chip equivalents, lower premium price point, predictions mechanic as a genuine differentiator.

Core claim: simplicity and fan enjoyment over analytical depth. "Very simple and fun to play, but tricky to win."

### User Sentiment

**What players love:**
- Predictions mechanic genuinely engaging — makes non-competitive races interesting regardless of team performance
- Social leagues sustain engagement within friend groups
- Loyal 17-year-old community; consistent return players year over year
- Accessible to newcomers with no prior fantasy sports experience required
- PRO pricing seen as very reasonable for a season-long commitment
- Fan-run identity resonates with players who find official F1 products over-commercialized

**Common complaints:**
- 6 changes for the entire season (free tier) is severely limiting for a 24-race calendar — players report running out and taking point penalties
- No push notifications for race deadlines; easy to miss lock times on a web-only platform
- Forgotten predictions: free-tier players who miss submitting predictions receive zero points for that race; PRO players can set default predictions to mitigate this
- Leaderboard volatility — one bad race can drop a player hundreds of places, which discourages casual players
- PRO budget boost (+$5M) feels like a pay-to-win element in a game with a tight $75M cap

## Assessment

### Strengths

- **Predictions mechanic is a genuine differentiator.** No other major F1 fantasy platform layers a predictions mini-game on top of team scoring. This rewards race-watching engagement over analytics and keeps players invested in race weekends even when their team is struggling.
- **Simplest roster format in the market (3+3).** Dramatically lower barrier to entry than more complex roster formats. Easier mental model for newcomers.
- **Sixteen-year track record.** Long-running platform with a loyal, returning community — trust and stability that newer platforms lack.
- **Free tier with full competitive access.** No paywall blocking serious play; PRO is meaningful but optional.
- **Fan-run, independent identity.** Authentic "for fans, by fans" positioning resonates with the engaged-but-non-commercial segment.

### Weaknesses

- **No native app and no push notifications.** In 2026, missing race lock deadlines is a real problem without push reminders. Players must remember to visit the website themselves — no automated alerts.
- **Declining player base.** 20,000+ (2018) to ~12,000 (2025). Losing ground to better-funded competitors.
- **Very restrictive free-tier transfer allowance.** Six changes across 24 races is the most frequently cited complaint. Players feel punished for normal team management.
- **No chip/boost mechanics.** No Wildcard, Limitless, Triple Captain, or equivalent — no high-drama strategic moments. The strategic ceiling is lower than competitors.
- **No in-platform community tools.** No chat, no in-game social features, no Discord/social platform integration.
- **PRO budget advantage is a balance concern.** +$5M in a $75M cap game is a 6.7% budget advantage — meaningful, and creates a mild pay-to-win dynamic.
- **Small team operational risk.** Three-person operation limits development velocity. The native apps were dropped in 2017 and have not returned.

### Relevance to Us

- **Predictions mechanic:** Fantasy GP's biggest differentiator and worth evaluating. A separate predictions mini-game that runs parallel to team scoring is a mechanic no major competitor has matched. If we ever add a social/engagement layer beyond team scoring, a predictions element is low-complexity and high-engagement. Not necessary for v1, but worth keeping in mind.
- **Team format contrast:** Their 3+3 format is the simplest in the market; our 4+4 lands between extremes. Our format gives constructors roughly equal weight to drivers — a meaningful structural difference.
- **Roster simplicity signal:** Fantasy GP's success (17 years, loyal community) with a 3+3 format suggests that simpler formats sustain engagement just as well as complex ones for casual friend-group play. Validates keeping our design approachable.
- **Free-tier transfer frustration:** Their 6-change-per-season free limit is their biggest UX pain point. Our transfer system should avoid artificial scarcity that creates frustration rather than strategy. A per-race allowance (rather than a seasonal pool) gives players more consistent agency throughout the season.
- **Budget advantage as pay-to-win:** Their PRO +$5M budget boost is a balance concern. We should never implement mechanical pay-to-win advantages if we add any premium features — cosmetic or social differentiation only.
- **No chips is survivable:** Fantasy GP runs without any chip system and has a loyal community. Chips add strategic depth but are not a requirement for a satisfying season-long game.
- **Predictions as engagement insurance:** The main value of predictions is keeping players engaged on weekends when their team is underperforming. Worth considering for our scoring design phase, especially in a friend-group context where disengagement is the main retention risk.
