# Scoring Simulation Analysis Report

Season: 2022 | Generated against candidate scoring rules from `scoring.md`

## C1 — Skill Ceiling

- Top driver: **VER** — 660 pts
- 80th percentile: 401 pts
- Median: 13 pts
- Top-to-median ratio: 50.77x ⚠️ FLAG: >3x target

## C2 — Volatility

Target: single race ≤ 20% of season total. Flagged drivers: 7
  - BOT: max 19 pts = 211.1% of 9
  - RIC: max 22 pts = 157.1% of 14
  - STR: max 14 pts = 116.7% of 12
  - DEV: max 3 pts = 100.0% of 3
  - HUL: max 6 pts = 100.0% of 6
  - VET: max 14 pts = 51.9% of 27
  - ALO: max 27 pts = 33.3% of 81

## C3 — Constructor Strategy

- Races where constructor scored negative: **107**
  - R1 AlphaTauri: driver_sum=3, penalty=-5, total=-2
  - R1 Red Bull Racing: driver_sum=-20, penalty=-10, total=-30
  - R2 Alpine: driver_sum=-1, penalty=-5, total=-6
  - R2 McLaren: driver_sum=1, penalty=-5, total=-4
  - R2 AlphaTauri: driver_sum=-4, penalty=-5, total=-9

Model team (top 5 drivers + top 3 constructors, no budget constraint):
  - Driver total: 2474
  - Constructor total: 2769
  - Constructor share: 52.8% ✅ above 25% target

## C4 — No Dominant Always-Picks

Top scorer per race distribution (out of 22 races):
  - VER: 15 races (68%) ⚠️ FLAG: >40%
  - LEC: 3 races (14%)
  - PER: 2 races (9%)
  - SAI: 1 races (5%)
  - RUS: 1 races (5%)

## C5 — Position Gain Calibration

Drivers earning ≥ 20 position-gain pts in a race (P20→P10 threshold): **0**

## C6 — Sprint Weekend Differential

- Sprint weekends: 3 | avg field total pts/round: 144
- Standard weekends: 19 | avg field total pts/round: 128
- Sprint-to-standard ratio: 1.12x
- Main race share of total pts on sprint weekends: 18.8%

## C7 — Captain Pick Variance

Optimal captain distribution (out of 22 races):
  - VER: 14 races (64%) ⚠️ FLAG: >40%
  - LEC: 4 races (18%)
  - PER: 2 races (9%)
  - SAI: 1 races (5%)
  - RUS: 1 races (5%)

## C8 — DNF Penalty Calibration

- Most DNFs: **LAT** (15 DNFs)
  - Season total with penalties: -119
  - Season total without penalties: 31
  - Penalties as % of pre-penalty total: 483.9% ⚠️ FLAG: >30%

All drivers with 3+ DNFs:
  - LAT: 15 DNFs, season total -119
  - TSU: 14 DNFs, season total -80
  - MSC: 13 DNFs, season total -75
  - MAG: 13 DNFs, season total -41
  - ALB: 12 DNFs, season total -81
  - ZHO: 12 DNFs, season total -78
  - BOT: 11 DNFs, season total 9
  - ALO: 10 DNFs, season total 81
  - GAS: 9 DNFs, season total -21
  - STR: 9 DNFs, season total 12
  - RIC: 8 DNFs, season total 14
  - VET: 7 DNFs, season total 27
  - SAI: 6 DNFs, season total 404
  - OCO: 5 DNFs, season total 157
  - NOR: 4 DNFs, season total 187
  - LEC: 3 DNFs, season total 516
  - HAM: 3 DNFs, season total 390
  - PER: 3 DNFs, season total 479

## C9 — Season Runaway Risk

⚠️ NOTE: No budget constraint applied — re-run after pricing is finalized.

### Final season totals
| Scenario | Total pts | vs. locked |
|----------|-----------|------------|
| Locked (race-1 optimal, held all season) | 3824 | — |
| 1 transfer/race | 6323 | +2499 |
| 2 transfers/race | 6604 | +2780 |
| Perfect hindsight | 6756 | +2932 |

### Mid-season snapshot (round 12)
| Scenario | Cumulative pts |
|----------|----------------|
| Locked | 2053 |
| 1 transfer | 3264 |
| 2 transfers | 3479 |
| Perfect | 3536 |

Gap from locked to perfect at mid-season: 1483 pts
Gap from locked to perfect at season end: 2932 pts
