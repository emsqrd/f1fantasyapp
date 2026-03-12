# Design Goals: F1 Fantasy App (2026 Season)

This document defines the intended player experience for the F1 Fantasy App. Every format, scoring, and pricing decision should be evaluated against these goals. If a design choice conflicts with a goal here, either the choice is wrong or the goal needs to be revisited and updated.

---

## Audience

**Serve both friend groups and the broader public equally.**

The app launches within a known friend group but is designed for public use from the start. This means:
- Rules must be legible to someone who has never played F1 fantasy before
- The game should be enjoyable whether you have 5 players in your league or 500
- Social/league mechanics matter as much as the solo scoring experience

---

## Skill Ceiling

**Moderate — knowledge helps, but it shouldn't be required.**

Casual F1 fans (those who watch races but don't follow mid-field closely) should be competitive. Deep knowledge of midfield timing deltas, tyre strategy trends, or chassis development trajectories should provide a real but not dominant edge.

Practically, this means:
- The top-3 drivers and top-2 constructors should not be so far ahead in scoring that picking them is always correct
- Mid-field picks should occasionally outperform expected results enough to reward the player who saw it coming
- A new player who just picks names they recognize should still have fun, not feel punished

---

## Volatility

**Moderate — individual races matter, but the season is the campaign.**

Any given race should be able to shift standings — a well-chosen team for Monaco should beat a complacent one. But a single bad race (retirement, rain chaos, safety car lottery) shouldn't eliminate a player from contention.

Practically, this means:
- A single race should not produce more than ~15–20% of a player's total season points
- Players who string together consistent good weeks should sit near the top
- Dramatic single-race swings are part of the game but shouldn't dominate the meta

---

## Constructor Weight

**To be determined through simulation.**

The 5D + 3C format gives constructors fewer slots than drivers, reflecting the smaller pool (11 constructors vs 22 drivers). Whether the slot ratio produces the right strategic weight depends on how scoring is calibrated. The goal is to revisit this after modeling — if constructor picks feel like an afterthought in simulation, scoring weights should be adjusted until they feel like genuine decisions.

A useful test: a player should be able to meaningfully differentiate themselves from an opponent based on constructor selection alone.

---

## DNF / Retirement Penalty

**Soft negative — noticeable but not season-ending.**

A driver retirement should hurt, but not catastrophically. Picking a driver who DNFs in a season with unreliable machinery shouldn't effectively eliminate a player.

Target: **-5 to -10 points** for a race DNF (applies to driver; constructor behavior TBD). This is enough to feel like a consequence without compounding into a crisis across an unreliable season.

Qualifying retirements should not carry the same penalty as race retirements — a car that can't make the grid through mechanical failure is different from one that races then breaks.

---

## Engagement Model

**Active in-race mechanics — require race-day decisions.**

Players should have something to do on race day beyond watching results roll in. Mechanics that require pre-race or race-day decisions create engagement without demanding real-time attention during the race.

The target model:
- **Captain pick** — designate one of your 5 drivers per race for 2x points; must be set before lock, changeable each race
- **Qualifying scores separately** — reward players who pay attention to the full weekend, not just Sunday

These mechanics should not become so complex that a casual player feels lost. Each one needs a clear one-sentence explanation.

---

## Transparency

**Publish the rules and scoring algorithm openly, without requiring login.**

Pricing formula and scoring tables should be publicly readable. Players should be able to verify their own points without contacting support. This is a differentiator against competitors (SportsDeck locks rules behind a login wall; F1 Fantasy's pricing algorithm is opaque).

---

## What This Is Not

- **Not pay-to-win.** Any paid features (if introduced) must be cosmetic or convenience only. No budget boosts, no extra transfers for money.
- **Not a simulation platform.** The game should be simple enough that a player can make their picks in under five minutes once they know the rules.
- **Not punishing for engagement gaps.** Missing a race's transfer window shouldn't compound into a lasting disadvantage beyond that race's score.
