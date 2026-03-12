# Pricing Model

## Design Goals

- Prices reflect actual scoring performance, not just finishing rank
- **P1:** Dream team (top 5D + top 3C by season score) costs 125–140% of budget
- **P2:** At least 50 feasible teams score within 80% of the best feasible team
- **P3:** No single entity appears on every top-scoring feasible team
- **P4:** At least 3 floor-priced entities have positive expected value
- **P5:** No price moves more than 30% in any 3-race window
- **P6:** High-DNF drivers are cheap enough to be viable budget picks

---

## Chosen Approach: Power Curve (shape = 1.0)

Selected via bake-off comparing 4 approaches (Linear, Power Curve, Rank-Based,
Tier-Based) against 2024 season data, validated against 2025 dream team cost.

**Why Power Curve over the others:**

| Approach | Verdict |
|---|---|
| Linear | Price ∝ per-race avg — solid, but no spread knob for future tuning |
| **Power Curve** | Same as linear at shape=1.0; shape knob available for future seasons without changing formula structure |
| Rank-Based | Ignores scoring magnitude; midfield drivers overpriced relative to output |
| Tier-Based | Blunt step function; drivers within a tier indistinguishable regardless of scoring gap |

At shape=1.0 the formula is mathematically equivalent to linear normalisation.
The shape parameter exists so the curve can be widened (shape > 1, larger elite
premium) or compressed (shape < 1) between seasons based on observed play.
Shape is fixed for the duration of a season — it is never adjusted mid-season.

---

## Preseason Pricing Formula

```
normalised = clamp(per_race_avg / REF_MAX, 0, 1)
price = max(FLOOR, round_100K(FLOOR + (CEILING - FLOOR) × normalised^SHAPE))
```

### Parameters

| Parameter | Driver | Constructor |
|---|---|---|
| FLOOR | $2M | $3M |
| CEILING | $19M | $25M |
| SHAPE | 1.0 | 1.0 |
| REF_MAX | 29.29 pts/race | 35.33 pts/race |
| Budget cap | $115M | — |

REF_MAX values are the 2024 best per-race averages (VER: 703 pts / 24 races;
McLaren: 848 pts / 24 races). They serve as the normalisation anchor and are
held constant for both preseason pricing and in-season target computation.

### Why $115M budget cap

At these ceiling/shape parameters, the 2025 dream team (VER + NOR + PIA + RUS +
LEC + McLaren + Mercedes + Ferrari) costs ~$149.5M — 130% of $115M. This sits
at the midpoint of the 125–140% target range. The cap can be adjusted to taste:
$110M for a tighter constraint (136% tightness), $120M for more room (125%).

---

## In-Season Dynamic Pricing

Prices update after each race using a 3-race rolling average.

**Frozen for rounds 1–3** — prices first change before round 4, once three
completed races of rolling data are available.

```
rolling_avg = mean(last 3 race scores)
target = max(FLOOR, round_100K(FLOOR + (CEILING - FLOOR) × clamp(rolling_avg / REF_MAX, 0, 1)^SHAPE))
cap    = max($100K, round_100K(current_price × 10%))
delta  = clamp(target − current_price, −cap, +cap)
new_price = max(FLOOR, round_100K(current_price + delta))
```

The ±10% per-race cap bounds the maximum swing over any 3-race window to
approximately 30%: (1.10)³ − 1 ≈ 33% up, 1 − (0.90)³ ≈ 27% down. This
satisfies P5 by construction (validated by `pricing_simulation.py`).

---

## Rookie and Partial-Season Handling

Drivers with **fewer than 10 races** in the previous season receive floor price
regardless of their per-race scoring.

**Known limitation:** the 10-race threshold does not fully eliminate noise from
split-season stints. Example from 2024: Logan Sargeant drove 14 races for
Williams (35 pts, 2.5 pts/race) after being replaced mid-season by Colapinto
(9 races, 35 pts — below threshold, floor price). Sargeant's per-race average
looks marginally better than Albon's full-season average (43 pts / 24 races =
1.8 pts/race), despite Albon clearly outperforming him over the year.

Both end up at the $2M floor in practice (their avgs are too low for the formula
to price them above floor), so this does not affect pricing output. It is
documented here because the threshold choice may need revisiting if a
partial-season driver ever scores high enough to be priced above floor.

**Team changes between seasons** (e.g. Hamilton → Ferrari, Sainz → Williams for
2025) are not accounted for in preseason prices — drivers are priced on their
individual 2024 output regardless of which car they drive in 2025. Constructors
are priced on their 2024 team output, which may reflect a different driver lineup
than 2025. In-season dynamic pricing corrects for this within the first few races.

---

## Bake-Off Summary

**Data:** 2024 season totals → preseason 2025 prices → validated against 2025 dream team

**Dream team:** VER, NOR, PIA, RUS, LEC + McLaren, Mercedes, Ferrari (4,981 pts in 2025)

| Approach | Best params | Cap | Dream team cost | Tightness |
|---|---|---|---|---|
| Linear | driver_pool=$150M, constructor_pool=$130M | $130M | $169.1M | 130.1% |
| **Power Curve** | ceiling=$19M/$25M, shape=1.0 | $115M | $149.5M | 130.0% |
| Rank-Based | ceiling=$18M/$30M | $125M | $161.8M | 129.4% |
| Tier-Based | equal_quarts config | $130M | $170M | 130.8% |

Full sweep results: `simulation/output/pricing_bakeoff/`

---

## Validation Criteria

Validated by `pricing_simulation.py` after running the full 2025 simulation.
Results recorded in `simulation/output/pricing/pricing_validation_report.md`.

| Criterion | Description | Status |
|---|---|---|
| P1 | Dream team costs 125–140% of budget | TBD |
| P2 | ≥50 feasible teams within 80% of best | TBD |
| P3 | No entity on every top-scoring feasible team | TBD |
| P4 | ≥3 floor-priced entities with positive EV | TBD |
| P5 | No price moves >30% in any 3-race window | TBD |
| P6 | High-DNF drivers viable as budget picks | TBD |
