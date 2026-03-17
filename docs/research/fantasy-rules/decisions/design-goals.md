# Design Goals: F1 Fantasy App

This document defines the intended player experience for the F1 Fantasy App. Every format, scoring, and pricing decision should be evaluated against these goals. If a design choice conflicts with a goal here, either the choice is wrong or the goal needs to be revisited and updated.

---

## Audience

**Serve both friend groups and the broader public equally.**

The app launches within a known friend group but is designed for public use from the start. This means:

- Rules must be legible to someone who has never played F1 fantasy before
- The game should be enjoyable whether you have 5 players in your league or 500
- Social/league mechanics matter as much as the solo scoring experience
- A player should be able to make their picks in under five minutes once they know the rules

---

## Emotional Experience

**Playing should produce moments worth caring about.**

The game should create genuine tension and occasional satisfaction — not just a leaderboard to check after the race. A captain choice that pays off, a mid-field driver who surprises, a well-timed transfer — these should feel like meaningful decisions.

The frustrations to avoid: feeling like there was only one correct team to pick, feeling like a single unlucky race made the rest of the season feel pointless.

---

## Skill Ceiling

**Moderate — knowledge helps, but it shouldn't be required.**

Casual F1 fans (those who watch races but don't follow mid-field closely) should be competitive. Deep knowledge of midfield timing deltas, tyre strategy trends, or chassis development trajectories should provide a real but not dominant edge.

Two valid engagement modes should coexist: a knowledgeable fan who anticipates performance before it shows in results, and a casual fan who reads recent form and makes reactive swaps. Both should produce competitive teams — the knowledgeable fan will see results sooner, and that's the intended edge.

Practically, this means:

- No combination of picks should be so obviously optimal that knowledge and judgment are irrelevant
- Mid-field picks should occasionally outperform expected results enough to reward the player who saw it coming
- A new player who just picks names they recognize should still have fun, not feel punished

---

## Volatility

**Moderate — individual races matter, but the season is the campaign.**

Any given race should be able to shift standings — a well-chosen team for Monaco should beat a complacent one. But a single bad race (retirement, rain chaos, safety car lottery) shouldn't eliminate a player from contention. Missing a race's transfer window shouldn't compound into a lasting disadvantage beyond that race's score.

The season arc should remain competitive for most players through most of the calendar. A league leader should feel pressure that they can be caught; players in the middle should have a realistic path upward. If the competition feels effectively over for most players by mid-season, the scoring structure has failed — that outcome should be the result of skill differences playing out over time, not front-loaded variance.

Practically, this means:

- Players who string together consistent good weeks should sit near the top
- Dramatic single-race swings are part of the game but shouldn't dominate the meta

---

## Engagement Model

**Active mechanics — require decisions beyond passive watching.**

Players should have something to do beyond watching results roll in. Mechanics that require pre-race or race-day decisions create engagement without demanding real-time attention during the race.

Each mechanic needs a clear one-sentence explanation. Nothing should require a tutorial to understand.

---

## Transparency

**Publish the rules and scoring algorithm openly, without requiring login.**

Pricing formula and scoring tables should be publicly readable. Players should be able to verify their own points without contacting support.

---

## Fairness Principles

**The game's mechanics should not create disadvantage beyond what F1 itself produces.**

All players operate under the same rules: same budget, same transfer allowance, same scoring. The only variables that should determine outcomes are the player's decisions and real-world race results. The game should not inject artificial variance, hidden mechanics, or advantages that aren't visible in the published rules. Any paid features must be cosmetic or convenience only — no budget boosts, no extra transfers for money.

---

## Pricing Behavior

**Prices should be readable signals, not mysteries.**

The purpose of in-season pricing is to reflect current performance. A player who looks at an entity's recent results and its current price should be able to anticipate the direction of the next price move. The mechanism is published and deterministic — no hidden factors, editorial overrides, or randomness after the season begins.

This is an extension of the Transparency goal: the pricing formula is public, and a motivated player can verify any price change against the published rules and official FIA results. The knowledge edge is seeing a price move coming before it happens, not in decoding an opaque mechanism.

---

## Team Evolution

**The optimal team should evolve over the season, not remain static.**

If a set-and-forget team selected at R1 is still optimal at R24, the pricing mechanism has failed to track real performance changes. F1 car development produces genuine competitive shifts — prices should follow these shifts closely enough that the best-value picks change meaningfully several times per season.

However, the pace of change should not punish inattention on a race-by-race basis. Missing a single transfer window should cost roughly one race's worth of suboptimal value, not compound into a lasting budget disadvantage. Both engagement modes from the Skill Ceiling goal must coexist: the proactive player who anticipates moves benefits sooner; the reactive player who reads recent form catches up within a few races.

---

## Active Management

**Active management earns a real but bounded advantage.**

A player who actively manages transfers — buying rising assets before they peak, selling declining ones before they bottom — should accumulate more budget headroom than a passive player over a full season. This is the intended reward for engagement.

The advantage must be bounded: a passive player with a well-chosen initial team should remain competitive through scoring alone. The active manager's edge is better value-for-money across the roster, not a fundamentally different team that a passive player could never afford. If the budget gap grows large enough to afford an extra elite asset, transfers have become too dominant relative to pick quality.

---

## Price Movement Uniformity

**Price movement rate is uniform across price tiers.**

All entities move by the same dollar amount per price adjustment, regardless of current price. This avoids two validated failure modes:

- **Compounding** — Percentage-based or price-proportional movement compounds over consecutive rounds, producing catastrophic drops that mislead players making decisions at the time of the drop.
- **Ceiling pinning** — Any designed-in stickiness at the top reduces the price signal for the most important entities in the game. The first model's most expensive entity showed zero price movement for two-thirds of the season.

Uniform dollar steps create emergent proportional stickiness — a fixed move is a smaller percentage of an expensive entity's price than a cheap one's. This is the right amount: enough that elite assets are somewhat stable, not so much that their prices stop responding to performance changes.

---

## Floor Compression

**Floor compression within the bottom tier is accepted by design.**

Backmarker entities may converge to the price floor and remain there regardless of scoring differences between them. This is structurally inherent to any floor-bounded pricing system and is accepted: bottom-tier entities are considered interchangeable for team-building purposes.
