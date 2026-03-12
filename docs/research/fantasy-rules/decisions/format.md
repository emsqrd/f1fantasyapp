# Format

## Context

SportsDeck is not offering their Grand Prix fantasy game for 2026. We need to define our own team format. This decision comes first because scoring and pricing both depend on it.

## The Grid

- 22 drivers across 11 constructors (2 drivers per constructor, plus an 11th team for 2026)

## Constructor Role — Decided

**Chosen approach: Bet on the car, scored differently than drivers.**

Constructors are scored based on their drivers' race results (keeping it transparent and data-simple), but with different mechanics than driver scoring. This gives constructors their own strategic identity without requiring exotic data sources like pit stop times or strategy ratings.

Three scoring layers create the constructor meta-game. See `scoring.md` for full details.

### Options considered

- **Bet on the car** (pure combined driver results) — Too simple. Constructor picks become redundant alongside driver picks. Stacking incentive (always pair driver + their constructor) reduces decision diversity.
- **Own entity** (independent scoring from pit stops, strategy, etc.) — Data sourcing problems. Hard to score objectively, hard for players to verify. Raises skill ceiling past the "moderate" target.
- **Multiplier/modifier** (constructor modifies driver scores) — Opaque. Players can't reason about what their pick is doing. Conflicts with transparency goal.
- **Bet on the car, scored differently** (chosen) — Same transparent inputs (finishing positions), but constructor-specific scoring mechanics create genuinely distinct decisions from driver picks.

## Slot Count — Decided

**5 drivers + 3 constructors.**

### Rationale

The 2026 grid has 22 drivers across 11 constructors — a 2:1 pool size disparity. Equal slot counts don't produce equal strategic weight; constructor picks are inherently less selective because the pool is smaller. The slot count should reflect that disparity rather than fight it.

Evaluated using two lenses:

| Config | Driver sel. | Constructor sel. | Total unique teams | Variation ratio |
|--------|------------|-----------------|-------------------|----------------|
| 3D + 3C | 14% | 27% | 254,100 | 9:1 |
| 4D + 2C | 18% | 18% | 402,325 | 133:1 |
| 5D + 2C | 23% | 18% | 1,448,370 | 479:1 |
| 4D + 4C | 18% | 36% | 2,413,950 | 22:1 |
| **5D + 3C** | **23%** | **27%** | **4,345,110** | **160:1** |
| 5D + 4C | 23% | 36% | 8,690,220 | 80:1 |

Ordered by total unique teams. **Selectivity** shows how much of each pool a player covers — closer values between driver and constructor mean more balanced strategic weight. **Variation ratio** shows how many times more differentiation comes from the driver side than the constructor side — the higher the number, the more constructors are noise.

Key inflection points: going from 2 → 3 constructor slots triples constructor combinations; going from 3 → 4 only doubles (diminishing returns). Going from 4 → 5 driver slots nearly quadruples driver combinations — the biggest single gain in the table. These marginal gains point to 5D + 3C as the stopping point before returns flatten on both sides.

### Additional factors

- **DNF resilience:** 5 drivers means one retirement is 20% of the roster, not 25% (4D) or 33% (3D)
- **Constructor strategy:** 3 slots give the three-layer scoring model enough room to build a real constructor strategy without covering so much of the field that picks converge
- **Differentiation:** No competitor uses this format — it's a genuine differentiator

## Decisions Needed

1. ~~What role do constructors play?~~ — Decided (see above)
2. ~~How many driver slots?~~ — Decided: 5
3. ~~How many constructor slots?~~ — Decided: 3
4. ~~Any constraints?~~ — Decided: No constraints beyond budget (see below)
5. ~~Captain/boost mechanic?~~ — Decided: 2x driver captain (see below)
6. ~~Driver replacements?~~ — Decided (see below)
7. ~~Setup window?~~ — Decided (see below)
8. ~~Mid-season joining?~~ — Decided (see below)
9. **Transfer mechanic?** — Undecided (see below)

## Format Comparison

See `../competitors/` for detailed per-platform breakdowns. Summary:

| Format | Used by | Constructor weight |
|--------|---------|-------------------|
| 5D + 2C | F1 Fantasy | Constructors are afterthoughts |
| 5D + 1C | GridRival | One constructor, high-stakes single choice |
| 3D + 3C | Fantasy GP | Balanced but roster feels thin |
| 4D + 4C | SportsDeck | Constructors carry equal weight |
| 2D + engine + chassis | GP Fantasy Game | Niche, high complexity |
| **5D + 3C** | **Ours** | **Constructors are meaningful, drivers are primary** |

## Constraints — Decided

**No constraints beyond the budget cap.**

Players can pick any combination of drivers and constructors, including both drivers from the same constructor, or a driver alongside their own constructor. Budget is the only limiter.

### Rationale

- Simplest possible rule: "pick 5 drivers, 3 constructors, stay under budget"
- Budget already prevents degenerate stacking — loading up on top-team assets is expensive, forcing trade-offs elsewhere
- No additional rule to explain lowers the barrier for new players (moderate skill ceiling goal)
- Allows conviction betting (going heavy on one team) as a deliberate strategy that carries concentration risk

### Options considered

- **Max 1 driver per constructor** — Forces grid spread but removes a real strategic axis. Felt paternalistic.
- **No driver-constructor stacking** (can't own a driver and their constructor) — Keeps pools independent but requires explanation that isn't intuitive to casual players.
- **No constraints** (chosen) — Simplest. Budget does the heavy lifting.

## Captain Mechanic — Decided

**2x multiplier on one rostered driver per race.**

Before each race's lock deadline, designate one of your 5 drivers as captain. That driver's total points for the race weekend (qualifying, race, and any bonuses) are doubled. Captain selection can change each race.

### Rationale

- Standard mechanic across competitors — proven and well-understood
- Adds a meaningful pre-race decision without complexity
- 2x is clean math players can do in their head
- Changeable each race keeps it as an active weekly decision (engagement goal)
- Applied to all points (not just race) so qualifying performance matters for captain selection too

## Driver Replacements — Decided

**If a driver is replaced before qualifying, they are not in the FIA classification and score 0 for the weekend. No penalty applies.**

A driver withdrawn before qualifying (e.g., due to medical emergency) is removed from the entry list and never appears in any classification. There is nothing to penalize — the owner simply scores 0 for that slot.

**If a driver is classified as DNS, the −10 DNS penalty applies.**

A driver who appears in the official classification as DNS was entered for the race, made it to race day, and did not start. This is post-lockout and attributable to car or driver issues. The standard DNS penalty applies.

**Before lock:** If a driver replacement is announced before the race lock deadline, it counts as a normal transfer against the owner's transfer allowance for that round. No special handling needed.

**After lock:** If a driver is replaced after the lock deadline, the owner scores 0 for that slot. No emergency replacement mechanic — the lock is the lock.

## Mid-Season Joining — Decided

**Mid-season joiners start at 0 points, can join any open league, and earn points from their first race onward.**

No catch-up mechanism. The points gap is the natural consequence of joining late. Late joiners benefit from the unlimited setup window (see below) and can see real-season performance data when building their initial team — that's offset enough given the points disadvantage.

## Setup Window — Decided

**Unlimited transfers before an owner's first race lock, regardless of when they join.**

Before the lock deadline of their first race weekend, owners can build and rebuild their team freely with no transfer cost or penalty. Once that lock passes, normal transfer rules apply for all subsequent races.

This applies equally to owners who join at the start of the season and those who join mid-season. A mid-season joiner has the advantage of real-season performance data when building their first team — this is an acceptable offset given they are already behind on points.

## Transfer Mechanic — Undecided

How many roster changes a player can make between races, and under what conditions.

### Decisions needed

1. **Free transfers per race** — how many changes are allowed without penalty each race?
2. **Rollover** — do unused free transfers carry forward to future races?
3. **Extra transfer cost** — is there a point penalty for transfers beyond the free allowance?
4. **Wildcard** — is there a once-per-season mechanic to replace the entire team freely?
5. **Deadline** — does the transfer deadline match the captain lock (pre-race), or is it earlier (pre-qualifying)?

### Why this matters

Transfer frequency directly affects:

- **Season runaway risk** — more flexibility lets players course-correct and stay competitive; too little flexibility can make an early optimal team uncatchable
- **Engagement** — weekly transfer decisions are a meaningful touchpoint beyond captain selection
- **Pricing** — if prices change dynamically over the season, transfer limits determine how much budget management matters week-to-week
- **DNF resilience** — how quickly a player can replace a consistently unreliable driver depends on transfer allowance

### Reference

- **F1 Fantasy**: 2 free transfers per race, bank up to 3 unused, −10 pts per extra; special chips: Wildcard (unlimited transfers within budget) and Limitless (unlimited, no budget cap) once per season each
- **GridRival**: No transfer system — uses a contract model instead (sign drivers to 1–5 race contracts, early release costs 3% of salary)
- **SportsDeck**: Seasonal allowance (~2–3 transfers per race, scaled to calendar length), max 2–3 per round; unlimited during initial setup window
- **Fantasy GP**: Seasonal pool — 6 changes (Rookie) or 40 changes (PRO) for entire season; −10 pts per extra; biggest UX pain point per competitor research
- **GP Fantasy Game**: 2 free transfers per race

Simulation results should inform this decision — specifically whether the scoring model produces runaway risk under a restricted transfer regime.

## Our Format

**5 drivers, 3 constructors. No roster constraints beyond budget. 2x captain on one driver per race. Unlimited setup before first race lock, mid-season joiners start at 0. Transfer mechanic TBD.**
