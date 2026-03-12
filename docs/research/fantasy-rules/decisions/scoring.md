# Scoring

## Context

Scoring rules need to be defined and published before launch so players can make informed team picks. The scoring engine can be built later, but the rules must exist first.

## Decisions Needed

1. ~~What actions earn points?~~ — Decided (see Scoring Events below)
2. ~~How many points per action?~~ — Decided (see Point Values below)
3. ~~Do constructors score differently than drivers?~~ — Decided (see Constructor Scoring below)
4. ~~Bonus/penalty events?~~ — Decided (see Scoring Events below)

## Reference

See `../competitors/` for how each platform handles scoring. Key findings from competitor analysis:

- Position-based scoring is universal — all platforms use a points table for finish position
- Qualifying points are common but weighted lower than race points
- Position gain bonuses (GridRival, SportsDeck) reward mid-field knowledge
- DNF penalties range from none to -20; softer penalties are better received
- Fastest lap bonuses are common (+20 pts)

## Constructor Scoring

A constructor's score for any session is the **sum of both drivers' fantasy points** for that session. No separate points table, no bonuses — whatever each driver scores, the constructor scores the same.

This keeps constructor scoring transparent and directly comparable to driver scoring. Players can calculate constructor scores in their head, and the relative value of constructor slots follows naturally from driver performance.

### How one-car dominance is handled

One-car teams are penalised implicitly. A constructor with a dominant first driver and a weak second driver scores less than a constructor with two strong drivers at similar positions:

| Constructor | Driver A total | Driver B total | Constructor total |
|-------------|----------------|----------------|-------------------|
| McLaren (Q2/Q5, P2/P5) | 30 pts | 23 pts | 53 pts |
| Red Bull (Q1/Q12, P1/P15) | 45 pts | 1 pt | 46 pts |
| Haas (Q8/Q9, P8/P9) | 11 pts | 8 pts | 19 pts |

Red Bull has the race winner but scores 7 pts less than McLaren as a constructor. Picking McLaren over Red Bull is the right call even when Verstappen wins — which is the intended strategic dynamic.

## Scoring Events — Decided

Nine scoring events across drivers and constructors. All inputs are publicly verifiable from FIA classification documents.

### Driver events

| Event | Type | Applies to | Notes |
|-------|------|-----------|-------|
| Race finish position | Points table | Race | Primary scoring event |
| Qualifying position | Points table | Qualifying | Rewards full-weekend attention |
| Sprint race finish | Points table | Sprint race | Scaled-down table (tertiary event) |
| Position gain bonus | Per-position bonus | Race + Sprint | Grid position → finish position, gains only |
| Fastest lap | Flat bonus | Race (+10) / Sprint (+5) | One driver per session |
| DNF / DSQ / DNS penalty | Flat penalty | Race | −10 points |
| DNF / DSQ / DNS penalty | Flat penalty | Sprint | −5 points |

**Sprint qualifying is not scored.** It determines sprint grid order but is the most obscure session of the weekend. The sprint race itself already rewards paying attention to sprint weekends.

**Position gain details:**
- Measured from **grid position** (after any penalties), not qualifying position. This avoids double-penalizing drivers who take grid penalties — they already lost positions from the penalty itself.
- **Gains only** — drivers who lose positions relative to their grid slot score zero on this event, not negative points. The lower finish position already reduces their race finish points, so symmetric scoring would double-count bad races. This aligns with the moderate volatility and soft penalty design goals.
- Applies to both the **main race and sprint race**.

**DNF / DSQ / DNS are treated identically within each session type.** Removed from competition is removed from competition, regardless of whether it happened before the race (DNS), during the race (DNF), or via post-race disqualification (DSQ). The penalty differs by session: **−10 for the main race, −5 for the sprint race.** The sprint penalty is halved to match the sprint's tertiary status — a sprint DNF should not cost more than winning the sprint earns.

**Qualifying DNF carries no penalty.** A driver who retires during qualifying scores their classified qualifying position as normal — no additional penalty is applied. The design goals explicitly distinguish qualifying retirements from race retirements.

**Classification determines DNF status.** The official FIA race classification is authoritative. A driver who retires but is still classified (completed 90%+ of race distance) scores their classified finishing position and receives no DNF penalty. A driver listed as DNF or Not Classified receives 0 finish points and the −10 penalty.

**Fastest lap bonus applies even if the driver DNFs**, provided the lap time stands in the final classification. A driver who sets the fastest lap then retires earns +10 (race) or +5 (sprint) plus the session's DNF penalty, netting 0 in both cases (race: +10 − 10 = 0; sprint: +5 − 5 = 0).

**Captain multiplier applies to positive points only.** DNF/DSQ/DNS penalties are always −10 (race) or −5 (sprint) regardless of captain designation. The captain mechanic is an upside tool, not a risk amplifier.

**Event hierarchy:**
- Race finish is the primary event (P1 = 25 pts). Qualifying and sprint race are secondary/tertiary events at ~40% and ~32% of race value respectively. Sprint weekends produce more total points than standard weekends, but the main race still dominates any given weekend.

### Constructor events

| Event | Type | Sessions |
|-------|------|---------|
| Driver points sum | Sum of both drivers' fantasy points | Qualifying + Race + Sprint |
| DNF penalty | −5 flat per DNF driver | Race + Sprint |

**Constructor scoring applies to qualifying, the main race, and sprint race.** The constructor's weekend total is the sum of both drivers' full fantasy points across all scored sessions, plus any constructor DNF penalties from race or sprint sessions.

**Constructor DNF penalty: −5 per DNF driver.** Applied when a constructor's driver receives a DNF/DSQ/DNS in either the race or sprint session. Softer than the driver-level race penalty (−10) since the constructor already loses the DNF driver's points contribution for that session. No constructor DNF penalty is applied for qualifying retirements, consistent with the driver-level rule.

### Events considered and excluded

- **Overtake points** — good candidate but excluded at launch due to data availability concerns. Requires lap-by-lap positional data not available from standard FIA classification documents. Can be added later if a data API is sourced; the scoring engine can accommodate it without restructuring.
- **Pit stop time bonus** — used by the official F1 Fantasy game. Interesting because it rewards constructor efficiency and strategy, not just finishing position. Excluded at launch due to data availability: pit stop times are not published in standard FIA classification documents and would require a paid API. Worth revisiting if a data source is added — the scoring engine can accommodate it without restructuring.
- **Beat teammate bonus** — used by Fantasy GP and GridRival. Excluded because it adds complexity without proportional strategic depth for our format.
- **Completion points / lap milestones** — GridRival awards points at 25%/50%/75%/90% of race distance. Excluded as overly granular for moderate skill ceiling goal.
- **Driver of the Day** — F1 Fantasy uses this. Excluded because it's a fan vote, not a performance metric, which conflicts with the transparency goal.
- **Practice session scoring** — GP Fantasy Game scores P1/P2/P3. Excluded as too niche and requires data most players won't follow.

## Point Values — Decided

Point values validated against 2024 and 2025 historical season data through simulation.

### Driver race finish position

Primary scoring event. Flatter than the F1 championship scale to make mid-field picks more viable (P1-to-P10 ratio is 12.5:1 vs F1's 25:1). P11–P15 earn 1 point, rewarding drivers who finish just outside the real points.

| Position | Points |
|----------|--------|
| P1 | 25 |
| P2 | 20 |
| P3 | 16 |
| P4 | 13 |
| P5 | 11 |
| P6 | 9 |
| P7 | 7 |
| P8 | 5 |
| P9 | 3 |
| P10 | 2 |
| P11–P15 | 1 |
| P16+ | 0 |

### Driver qualifying position

Mirrors F1 Fantasy's qualifying table. Weighted at 40% of race scoring (P1 = 10 vs 25), clearly secondary to race day.

| Position | Points |
|----------|--------|
| P1 | 10 |
| P2 | 9 |
| P3 | 8 |
| P4 | 7 |
| P5 | 6 |
| P6 | 5 |
| P7 | 4 |
| P8 | 3 |
| P9 | 2 |
| P10 | 1 |
| P11+ | 0 |

### Sprint race finish position

Mirrors F1 Fantasy's sprint table. Tertiary event — top 8 only, P1 = 8.

| Position | Points |
|----------|--------|
| P1 | 8 |
| P2 | 7 |
| P3 | 6 |
| P4 | 5 |
| P5 | 4 |
| P6 | 3 |
| P7 | 2 |
| P8 | 1 |
| P9+ | 0 |

### Position gain bonus

**+1 point per position gained** (grid position → race finish, gains only). A driver who starts P15 and finishes P8 gains 7 positions = +7 bonus points.

### Fastest lap bonus

**+10 points (race), +5 points (sprint).** The race bonus is roughly equivalent to finishing one position higher on the race table. The sprint bonus is halved to reflect the sprint's tertiary status. Applies even if the driver DNFs, provided the lap time stands in the final classification.

### DNF / DSQ / DNS penalty

**Race: −10 points.** Applies equally to DNF (retired during race), DSQ (disqualified post-race), and DNS (did not start). −10 is equivalent to losing a P6 finish — noticeable without being catastrophic over a season.

**Sprint: −5 points.** Halved to match the sprint's tertiary status. A sprint DNF costs less than winning the sprint earns (+8), keeping the penalty proportionate to the session's weight.

**Constructors: −5 per DNF/DSQ/DNS driver, in either session.** Softer than the driver race penalty because the constructor already loses that driver's points contribution for the session.

### Worked examples with point values

**Driver weekend (standard):**

| Scenario | Race | Qualifying | Gain bonus | Total |
|----------|------|-----------|------------|-------|
| Dominant (P1 race, P1 quali, no gain) | 25 | 10 | 0 | 35 |
| Mid-field mover (P6 race, P12 quali, +6 grid→finish) | 9 | 0 | 6 | 15 |
| Consistent mid (P7 race, P6 quali, +1) | 7 | 5 | 1 | 13 |
| Just outside points (P12 race, P14 quali, +2) | 1 | 0 | 2 | 3 |

**Constructor weekend (standard — qualifying + race):**

| Constructor | Driver A (quali + race) | Driver B (quali + race) | DNF penalty | Total |
|-------------|------------------------|------------------------|-------------|-------|
| McLaren (Q2/Q5, P2/P5, clean) | 9 + 21 = 30 | 6 + 17 = 23 | 0 | 53 pts |
| Red Bull (Q1/Q12, P1/P15, clean) | 10 + 35 = 45 | 0 + 1 = 1 | 0 | 46 pts |
| Haas (Q8/Q9, P8/P9, clean) | 3 + 8 = 11 | 2 + 6 = 8 | 0 | 19 pts |
| Williams (Q11/Q16, P12/DNF) | 0 + 1 = 1 | 0 + 0 = 0 | −5 | −4 pts |

Red Bull has the race winner but scores 7 pts less than McLaren as a constructor. The second seat is priced into the constructor pick.

---

## Archived: Three-Layer Constructor Model

An alternative constructor scoring model explored during design. Not adopted — simulation showed it created cliff effects around the gate threshold and didn't reliably achieve its stated goals — but kept here for reference if the simple model proves too flat in practice.

**Layer 1 — Base scoring:** Each constructor scores from both drivers' finishing positions using a flatter points table than drivers (P1-to-P10 ratio 6:1 vs 12.5:1). P11–P15 = 1 pt, P16+ = 0.

| Position | P1 | P2 | P3 | P4 | P5 | P6 | P7 | P8 | P9 | P10 | P11–15 | P16+ |
|----------|----|----|----|----|----|----|----|----|----|-----|--------|------|
| Points   | 12 | 10 |  9 |  8 |  7 |  6 |  5 |  4 |  3 |   2 |      1 |    0 |

**Layer 2 — Both-cars bonus:** +10 pts when both drivers finish in the top 10 (main race) or top 8 (sprint). Binary — either both in the points or not.

**Layer 3 — Spread bonus:** Tiered by gap between the two drivers' finishing positions. Gated behind Layer 2 (only applies when both cars are in the points). Rewards teams where both drivers perform — penalises one-car dominance.

| Gap | Bonus |
|-----|-------|
| 0–1 positions | +8 |
| 2–3 positions | +5 |
| 4–5 positions | +3 |
| 6+ positions | 0 |

**Why it was explored:** The intent was to reward mid-field team balance and penalise one-car dominant teams (e.g., Verstappen carrying Red Bull). **Why it was not adopted:** The Layer 2 gate is tied to car pace, not team decisions — backmarker teams can never unlock Layer 2 regardless of how reliably both cars finish. Simulation showed Williams (2024) and Alpine (2025) scoring near zero or negative under this model despite completing full seasons, while the gate threshold had to be calibrated carefully to avoid unintended benefits for teams like Red Bull. The simple driver-sum model handles the one-car dynamic implicitly through the driver points table.
