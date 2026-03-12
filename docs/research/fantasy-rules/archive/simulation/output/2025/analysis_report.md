# Scoring Simulation Analysis Report

Season: 2025 | Generated against candidate scoring rules from `scoring.md`

## C1 — Skill Ceiling

- Top driver: **VER** — 646 pts
- 80th percentile: 395 pts
- Median: 129 pts
- Top-to-median ratio: 5.01x ⚠️ FLAG: >3x target

## C2 — Volatility

Target: single race ≤ 20% of season total. Flagged drivers: 7
  - BOR: max 14 pts = 42.4% of 33
  - COL: max 7 pts = 33.3% of 21
  - HUL: max 32 pts = 26.9% of 119
  - LAW: max 19 pts = 25.7% of 74
  - ALO: max 17 pts = 22.7% of 75
  - GAS: max 14 pts = 21.9% of 64
  - SAI: max 25 pts = 21.4% of 117

## C3 — Constructor Strategy

- Races where constructor scored negative: **49**
  - R1 Williams: driver_sum=2, penalty=-5, total=-3
  - R1 Alpine: driver_sum=-9, penalty=-5, total=-14
  - R1 Racing Bulls: driver_sum=-9, penalty=-5, total=-14
  - R2 Aston Martin: driver_sum=-2, penalty=-5, total=-7
  - R2 Alpine: driver_sum=-4, penalty=-5, total=-9

Model team (top 5 drivers + top 3 constructors, no budget constraint):
  - Driver total: 2796
  - Constructor total: 2728
  - Constructor share: 49.4% ✅ above 25% target

## C4 — No Dominant Always-Picks

Top scorer per race distribution (out of 24 races):
  - VER: 8 races (33%)
  - NOR: 7 races (29%)
  - PIA: 7 races (29%)
  - RUS: 2 races (8%)

## C5 — Position Gain Calibration

Drivers earning ≥ 20 position-gain pts in a race (P20→P10 threshold): **0**

## C6 — Sprint Weekend Differential

- Sprint weekends: 6 | avg field total pts/round: 236
- Standard weekends: 18 | avg field total pts/round: 179
- Sprint-to-standard ratio: 1.31x
- Main race share of total pts on sprint weekends: 52.3%

## C7 — Captain Pick Variance

Optimal captain distribution (out of 24 races):
  - VER: 8 races (33%)
  - NOR: 7 races (29%)
  - PIA: 7 races (29%)
  - RUS: 2 races (8%)

## C8 — DNF Penalty Calibration

- Most DNFs: **ALO** (5 DNFs)
  - Season total with penalties: 75
  - Season total without penalties: 125
  - Penalties as % of pre-penalty total: 40.0% ⚠️ FLAG: >30%

All drivers with 3+ DNFs:
  - ALO: 5 DNFs, season total 75
  - SAI: 5 DNFs, season total 117
  - LAW: 5 DNFs, season total 74
  - BOR: 5 DNFs, season total 33
  - ALB: 4 DNFs, season total 145
  - HUL: 4 DNFs, season total 119
  - ANT: 4 DNFs, season total 260
  - GAS: 3 DNFs, season total 64
  - HAD: 3 DNFs, season total 120
  - HAM: 3 DNFs, season total 306
  - BEA: 3 DNFs, season total 131
  - LEC: 3 DNFs, season total 395
  - NOR: 3 DNFs, season total 623

## C9 — Season Runaway Risk

⚠️ NOTE: No budget constraint applied — re-run after pricing is finalized.

### Final season totals
| Scenario | Total pts | vs. locked |
|----------|-----------|------------|
| Locked (race-1 optimal, held all season) | 5748 | — |
| 1 transfer/race | 6802 | +1054 |
| 2 transfers/race | 7147 | +1399 |
| Perfect hindsight | 7358 | +1610 |

### Mid-season snapshot (round 13)
| Scenario | Cumulative pts |
|----------|----------------|
| Locked | 3019 |
| 1 transfer | 3780 |
| 2 transfers | 3901 |
| Perfect | 3969 |

Gap from locked to perfect at mid-season: 950 pts
Gap from locked to perfect at season end: 1610 pts
