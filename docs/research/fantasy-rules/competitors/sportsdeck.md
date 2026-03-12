# SportsDeck (sportsdeck.com)

## Core Product

### Target Audience

Australasian (Australian and New Zealand) sports fans — not dedicated F1 fans. Sportsdeck bills itself as "Australasia's original and most comprehensive fantasy network," and F1 is one of 25+ games across 12+ sports (AFL, NRL, NBA, NFL, EPL, Cricket, MotoGP, Supercars, Horse Racing, etc.). The F1 product targets casual multi-sport fantasy players who already use Sportsdeck for other sports, not F1 enthusiasts who sought out a dedicated platform.

Low time commitment is a deliberate design choice: the game is described by the platform and users alike as "easy to do and importantly doesn't require much time at all to manage."

### Format Orientation

**Casual, season-long salary cap.** The game runs the full F1 season, not race-by-race DFS. Design emphasizes ease of use and low management overhead. No hardcore simulation depth — AI tools are there to do the thinking for you.

### Core Game Loop

1. **Pre-season:** Pick a team of 4 drivers + 4 cars within a $120M budget cap. Unlimited trades allowed during round 1 to finalise the squad.
2. **Each race weekend:** Teams lock at qualifying. Drivers and cars earn points based on positions gained vs. their qualifying grid position; fastest lap earns a 20-point bonus. Designate a captain driver (doubles their score for that round).
3. **Between races:** Make limited trades (seasonal allowance, capped per round); prices begin moving after round 3 based on performance.
4. **Season-long:** Compete in global standings and private leagues (invite-code based).

One team per account.

### Team Format

| Slot                | Count |
| ------------------- | ----- |
| Drivers             | 4     |
| Constructors (cars) | 4     |
| Budget              | $120M |
| Teams per account   | 1     |

- **Captain:** One driver designated per race as captain — scores double points. If you forget to set one, the game auto-assigns your highest scorer.
- **Transfers:** Unlimited trades during round 1 (initial team setup). After that, a fixed seasonal allowance applies (scales with the calendar — 26 trades across a ~21-race season; 44 trades across a ~23-race season), capped at a maximum of 2–3 trades per round.
- **Lock timing:** Teams lock at the start of qualifying for each round.
- **Price changes:** Prices remain static for the first 3 rounds, then begin fluctuating based on recent performance averages.

> **Confidence note:** Team format (4 drivers + 4 cars, captain mechanic, transfer rules, scoring) is corroborated by two independent f1banter.co.uk community threads covering the 2019 and 2021 seasons; the $120M budget has been directly verified for the current season. The single-team-per-account limit is confirmed by the platform operator but not independently verified from a public source. Transfer counts vary by season calendar length — exact 2025 figures are unconfirmed.

### Key Features

- **Captain mechanic** — One driver earns double points per race; auto-assigned to highest scorer if not set.
- **Position-gain scoring** — Points are awarded for positions gained vs. qualifying grid (4 pts/position), plus a 20-pt fastest lap bonus shared by driver and car. This diverges from the finish-position tables used by the official F1 Fantasy game.
- **AI team management (DT.AI):** Auto-Pick, The Optimiser, and Trade Assist suggest team changes and automate selections. Primarily known for AFL/NRL but listed as a platform-wide feature.
- **Mock Drafts** — Practice team-building before committing.
- **Trade Boost / Trade Update** — Strategic tools for timing and executing trades.
- **Single team per account** — One team per user; no multi-teaming.
- **Private leagues** — Invite-code leagues for competing with friends.
- **Multi-sport hub** — One account and one app covers all 25+ sports.

### UX/Accessibility

- **Mobile-first:** Native iOS and Android apps (com.vapormedia.sportsdeck).
- **Web:** sportsdeck.com, built as an SPA (Angular/Material Design); does not publicly render game content — a login is required before any game content is visible.
- **No public preview:** The F1 game is entirely behind a login wall. Prospective users cannot browse rules, player prices, or standings without creating an account.
- Described as easy to navigate once inside; straightforward interface familiar to fantasy sports veterans.

---

## Business & Market

### Monetization

**Freemium.** The base game is free. A premium tier called **"Assistant Coach"** (analogous to Gold Pass in SuperCoach) unlocks additional tools and features. The 2025 season introduced the Team Picker tool exclusively via an Assistant Coach subscription.

Exact pricing for the Assistant Coach subscription was not publicly available in external sources.

### Market Presence

- **Established:** Sportsdeck has operated since approximately 2000 — they celebrated their 25th anniversary in 2025. The F1 Dream Team has been running since at least 2008.
- **Geography:** Primarily Australia and New Zealand; limited global footprint.
- **Scale:** No public user count figures found. Community threads suggest a dedicated long-term player base, not a massive mainstream audience.
- **App ratings:** Listed on both App Store and Google Play; no specific rating data surfaced in research.

### Positioning

**"The Original Dream Team"** — Sportsdeck's identity is built on longevity and breadth, not F1 depth. They are the go-to multi-sport fantasy hub for Australian fans who don't want to manage separate accounts on DraftKings, SuperCoach, and ten other platforms.

F1 is a secondary product for them. It benefits from the platform's established infrastructure but receives no dedicated marketing or F1-specific brand investment.

### User Sentiment

Mixed-to-positive, with a distinct casual skew:

- Long-time players appreciate the low effort required and the convenience of a multi-sport hub.
- One community member has used it for F1 and Supercars since 2008 — strong retention signal.
- A third-party review (2017) noted it as "not quite as good as FPL" in terms of depth and polish, but praised it for filling the gap where no quality official fantasy game existed.
- One player described it as "most frustrating internet game's known to man" — interpreted as engagement through difficulty, not a bug.
- No significant negative trend found (no vocal Reddit complaints or app store review patterns surfaced in research).

---

## Assessment

### Strengths

- **25+ years of trust and history** in Australian fantasy sports — deep brand equity with their existing audience.
- **Multi-sport convenience:** One app and account for F1, AFL, NRL, NBA, etc. is a real retention driver for Australian sports fans.
- **Native mobile apps** on both platforms — lowers friction vs. web-only competitors.
- **AI tooling (DT.AI):** Auto-Pick, Optimiser, and Trade Assist make it accessible to casual players with no fantasy sports expertise.
- **Captain mechanic** adds a weekly decision layer that increases engagement without adding complexity.
- **Single team per account** — keeps the experience focused; no multi-team management overhead.
- **Free base game** removes financial barrier to entry.
- **Established F1 community** — has kept the same players for a decade or more.

### Weaknesses

- **F1 is not the focus.** There is no evidence of F1-specific investment in features, branding, or community building. Improvements to the F1 game appear to come as byproducts of platform-wide improvements.
- **Hard login wall** — no public browsing of player prices, rules, standings, or team composition. Kills discoverability and creates friction for new users.
- **Primarily Australian.** Not built for or marketed to the global F1 audience.
- **Depth vs. polish tradeoff:** Praised for breadth but noted as inferior to specialized platforms in quality. The AI tools may obscure rather than teach the game.
- **Scoring opacity:** Game rules are not publicly accessible, making it difficult to evaluate or compare without an account.
- **Scoring model diverges from industry norm:** The position-gain model (4 pts/position vs. qualifying) is interesting but unfamiliar to players coming from the official F1 Fantasy game. No penalties for DNFs were mentioned in community threads — unknown whether those exist.
- **4 constructors vs. industry norm:** Using 4 constructor slots (vs. 2 in the official game) is a significant structural difference that can confuse players switching between games.

### Relevance to Us

- **Team format alignment:** Sportsdeck uses 4 drivers + 4 constructors — the same structural shape as our app (4+4). This is the closest format match of any competitor researched, and gives us some validation that equal driver/constructor weighting is a viable design. Their budget is $120M (vs. our $100M).
- **Captain mechanic:** The auto-assignment fallback (highest scorer becomes captain if forgotten) is a thoughtful UX detail — it lowers the cost of forgetting while still rewarding players who engage. If we implement captain functionality, this fallback behaviour is worth adopting.
- **Position-gain scoring:** Their 4-pts-per-position-gained model rewards overtakes and charges through the field, not just raw finishing position. This is a genuine alternative to the finish-position table approach. GridRival uses a similar overtake bonus on top of a position table; Sportsdeck bakes it in as the primary mechanism. Relevant to our scoring design decisions.
- **Price changes delayed until round 3:** Keeping prices static for the first 3 races gives players time to understand the market before values start moving. This is a user-friendly calibration choice worth considering for our own price-change rollout timing.
- **Limited seasonal trade budget:** The fixed seasonal trade allowance (scaled to calendar length) creates meaningful scarcity without punishing casual players too harshly in any single round. A useful reference point when we design transfer rules.
- **Login wall:** Everything is gated behind an account — no public browsing of standings, prices, or even rules. This is a discoverability liability. Keeping our app publicly readable (at least for league standings and player prices) would be a genuine differentiator against Sportsdeck specifically.
- **AI tooling as a premium feature:** Sportsdeck's "Assistant Coach" tier (Auto-Pick, Optimiser, Trade Assist) demonstrates willingness to pay for automation in this user base. Worth keeping in mind for a future premium tier, but YAGNI for now.
- **Primarily Australian, casual audience:** Sportsdeck's F1 user base is loyal but geographically narrow and explicitly low-engagement. The broader global F1 audience — particularly the post-Drive-to-Survive wave of fans — remains underserved by a dedicated, non-Australian-centric alternative.
