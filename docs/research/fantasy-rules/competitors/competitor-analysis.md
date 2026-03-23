# F1 Fantasy Competitor Analysis

## Purpose

General market research on active F1 fantasy platforms. Understanding each platform's approach, target audience, and differentiators informs our format, scoring, and pricing decisions — and positions us well if the app grows beyond our friend group.

## Research Guidelines

- Always search for data on the current/upcoming season first. Fall back to the prior season only when current-season data is unavailable.
- Note which season each piece of data applies to (e.g., demographics from 2024, scoring rules from 2025).
- All findings must come from public sources only: platform websites, app store reviews, web search, and official documentation. Do not read any other files in this repository.
- Treat each platform as if you have no prior knowledge of it — research everything fresh.

## Evaluation Dimensions

For each platform, capture:

**Core Product:**
- **Target audience** — Casual fans? Hardcore? Who are they going after?
- **Format orientation** — Casual, competitive, or both? How does the design reflect that?
- **Core game loop** — What does the player actually do each week?
- **Team format** — Slots, budget, constraints
- **Key features** — What do they emphasize? Leagues, stats, social, etc.
- **UX/accessibility** — App? Web? How easy to get started?

**Business & Market:**
- **Monetization** — Free? Freemium? Paid features?
- **Market presence** — How established? User base size if known
- **Positioning** — How do they differentiate themselves?
- **User sentiment** — App store reviews, Reddit, what people love/hate

**Assessment:**
- **Strengths** — What do they do well?
- **Weaknesses** — What's lacking or frustrating?
- **Relevance to us** — What can we learn or borrow?

## Platform Details

Detailed findings for each platform:

1. [Official F1 Fantasy](competitors/f1-fantasy.md)
2. [GridRival](competitors/gridrival.md)
3. [Fantasy GP](competitors/fantasy-gp.md)
4. [GP Fantasy Game](competitors/gp-fantasy-game.md)
5. [SportsDeck](competitors/sportsdeck.md)

## Summary Comparison

| | Official F1 Fantasy | GridRival | Fantasy GP | GP Fantasy Game | SportsDeck |
|---|---|---|---|---|---|
| **Format** | 5D + 2C | 5D + 1C | 3D + 3C | 2D + 1 engine + 1 chassis | 4D + 4C |
| **Budget cap** | $100M | $100M | $75M | 100M (fictional) | $120M |
| **Scoring basis** | Position tables + bonuses | Position + overtakes + improvement | Position tables + predictions | Position tables, all sessions incl. practice | Position gain (4 pts/place gained) |
| **Transfers** | 2/race, bank up to 3 | Contracts (1–5 race lock-in) | 6/season free; 40/season PRO | 2/race | Seasonal allowance, 2–3/round max |
| **Special mechanics** | 6 chips + DRS Boost | Talent Driver, contracts | Predictions mini-game | Pitstop predictions, in-game economy | Captain (auto-fallback), AI tools |
| **Captain / boost** | DRS Boost (free weekly) | Talent Driver (low-salary only) | None | None | Captain (doubles score) |
| **Monetization** | Free (fan engagement for Liberty Media) | Free; US-only DFS for real money | Free + £9.99/season PRO | Free (ad-supported) | Free + premium tier |
| **Platform** | Web + native app (inside F1 app) | Native iOS/Android only | Web only | Web only | Web + native iOS/Android |
| **Scale** | 1.5M+ players | 100K+ (est.) | ~12K active | ~8.9K registered | Unknown (AU/NZ focused) |
| **Target audience** | Young/casual; fan engagement tool | Engaged strategic fans | Casual fans, friend groups | Dedicated F1 enthusiasts | Casual AU/NZ multi-sport fans |
| **Complexity** | Casual-first, competitive opt-in | Competitive-leaning | Firmly casual | Moderate-to-competitive | Casual |
| **Pricing transparency** | Opaque (frequently criticized) | Fully published formula | Not documented | Not documented | Not documented |

## Market Observations

**$100M budget cap is the de facto standard.** F1 Fantasy and GridRival both use $100M. Fantasy GP uses $75M with a tighter 3+3 roster. Only SportsDeck diverges significantly at $120M. This convergence around $100M means our own $100M cap is immediately familiar to players who've used the dominant platforms.

**5 drivers + 2 constructors is the dominant format, but not universal.** Both F1 Fantasy and GridRival — the two most popular platforms — use 5D+2C. This makes constructors a secondary consideration: they're two slots on a seven-slot team. The platforms that diverge (Fantasy GP at 3+3, SportsDeck at 4+4) each give constructors more relative weight. Only SportsDeck matches our 4+4 structure.

**Free-to-play is the baseline; monetization strategies diverge.** All five platforms offer free core play. The official F1 Fantasy is entirely free (monetizes indirectly). GridRival charges for US daily fantasy only. Fantasy GP has a low-cost PRO tier (£9.99/season). GPFG is ad-supported only. Sportsdeck has a premium tier for AI tooling. Pay-to-win mechanics are generally avoided — Fantasy GP's +$5M PRO budget boost is the only example and is the source of its main user complaint.

**Transfer scarcity is one of the most common pain points.** Fantasy GP's 6-changes-per-season free limit is their most cited complaint by a wide margin. GPFG's 2/race with no banking generates entry-fee timing confusion. Even F1 Fantasy's per-race model gets criticism when transfers are "wasted" on swaps the player later reverses. Generous, fair transfer mechanics are a meaningful differentiator — and missing this creates lasting resentment.

**Scoring transparency varies widely; opacity is a recurring complaint.** F1 Fantasy's pricing algorithm is frequently criticized as opaque. GPFG has recurring scoring disputes that have persisted for years. GridRival is the only platform with a publicly documented, exact pricing formula — and user sentiment confirms this is a trust signal. No platform offers full scoring transparency in real-time; Fantasy GP's PRO-only live scoring is the closest.

**Native mobile apps correlate with better user sentiment.** GridRival (~4.7/5 App Store) has the best reviews of any competitor and is native-only. Fantasy GP dropped their apps in 2017 and explicitly lacks push notifications — their top UX complaint after transfer limits. GPFG has no app at all. The platforms with the worst mobile experiences have the most retention problems. Push notifications for lock deadlines are not a nice-to-have in a sport where missing a qualifying lock is irreversible.

**Social and community features are universally weak — except GridRival.** F1 Fantasy has no league member visibility, stale H2H matchmaking, and no chat. Fantasy GP has no in-app communication tools at all. GPFG has only a forum (active since 2009 but not modern). GridRival is the only platform with in-app chat, a Global Paddock community feed, and meaningful league admin controls. Given that friend-group play is the primary retention driver across all platforms, the gap between GridRival and everyone else is significant.

**The "engaged but not hardcore" segment is underserved.** Platforms cluster at two ends: very casual (F1 Fantasy, Fantasy GP, SportsDeck) or strategically demanding (GridRival's contracts, GPFG's in-game economy). The middle segment — fans who know the field well and want meaningful decisions each race, but don't want to manage 5-race contracts or a seasonal currency budget — is not well served by any current platform.

**DNF/non-scoring penalties are calibrated inconsistently.** F1 Fantasy's −20 race DNF is their most contentious scoring element. GridRival's completion points (awarded at 25/50/75/90% of planned laps) act as a softer penalty. GPFG mentions no DNF penalties in any reviewed source. Fantasy GP awards completion bonuses (+2 for one car finishing, +5 for both) rather than penalizing failure. The market has not converged on a standard here.

## Relevance to Our App

**Our current 4+4 format matches SportsDeck, but the team format is an open design question.** The dominant market format is 5D+2C (F1 Fantasy, GridRival), which makes constructors an afterthought. Our 4+4 gives constructors equal slot weight, but the right format should follow from deliberate decisions about constructor role and scoring — not be inherited from a competitor by default.

**Adopt net-change transfers — this is a firm requirement.** F1 Fantasy's net-change counting (only the final lineup delta is counted, not intermediate swaps) is the right model. It removes the fear of experimenting before the lock deadline. Players should never feel punished for exploring options they then reverse. This should be a design invariant when we implement the transfer system, not an afterthought.

**Publish our pricing algorithm.** We've already reverse-engineered the SportsDeck formula (documented in memory). GridRival's published formula is confirmed as a trust differentiator by user sentiment. F1 Fantasy's opacity is their most cited frustration among strategic players. Publishing our exact formula costs us nothing and earns player trust. It should be in the UI, not buried in documentation.

**Our captain mechanic is validated; adopt the auto-fallback.** Sportsdeck auto-assigns the captain to the highest scorer for that race if the player forgets to set one. This is the right UX default — it rewards engagement (manually picking your captain) without punishing casual players (forgetting doesn't zero out the mechanic). We already have captain functionality; this fallback is worth implementing.

**Calibrate scoring to make mid-field constructors meaningful.** With 4 constructor slots, constructor scoring matters far more to us than to F1 Fantasy or GridRival. Flat position-based scoring rewards top teams almost exclusively. GridRival's improvement points (above-average finishes) and overtake scoring, and SportsDeck's position-gain model, both make picks across the full grid interesting. We should design our scoring to reward knowledge of the mid-field, not just the ability to identify the top two teams.

**Calibrate DNF penalties carefully, erring conservative.** F1 Fantasy's −20 race DNF is their most contentious rule element by user sentiment. Harsh DNF penalties punish luck more than strategy and create frustration disproportionate to the engagement value. Consider softer alternatives: completion bonuses (Fantasy GP model), partial-credit lap thresholds (GridRival model), or a reduced flat penalty. This is a scoring design decision, not a v1 blocker.

**Per-race transfer allowance with banking is the best-tested model.** F1 Fantasy's 2 free transfers per race, banking up to 3, is the most player-friendly tested structure. Seasonal pools (Fantasy GP's 6/season free tier) create the worst frustration. GPFG's 2/race with no banking is acceptable but inflexible. Banking gives casual players a buffer when they miss a race and prevents the season feeling "over" after a few unlucky rounds.

**Keep rules public and browsable without login.** Sportsdeck's hard login wall is cited explicitly as a discoverability liability. Players should be able to view standings, player prices, and scoring rules without an account. This is table stakes for discoverability and a direct differentiator against Sportsdeck.

**Predictions mechanic is a future option, not a v1 need.** Fantasy GP's race predictions (pole, podium, fastest lap, safety cars, bonus question) are their clearest differentiator and specifically solve the disengagement problem when a team underperforms. In a friend-group context, disengagement is the primary retention risk. This mechanic is worth tracking for a future iteration — it's low-complexity, high-engagement, and no major competitor has replicated it.

**League admin flexibility matters for our use case.** GridRival's admin tools — adjusting member points, removing members, in-league chat — are well-regarded and directly applicable to friend-group play. Our primary use case is private leagues, so admin control and social features are higher-priority than in a global-competition context. Build these before we need to retrofit them.

**Avoid pay-to-win mechanics if we ever add a premium tier.** Fantasy GP's +$5M PRO budget boost is their main balance complaint. Any premium features we add should be cosmetic or social (profile customization, stats history, admin tools) — never mechanical advantages in team-building or scoring.
