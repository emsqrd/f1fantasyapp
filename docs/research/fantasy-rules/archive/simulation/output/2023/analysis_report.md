# Scoring Simulation Analysis Report

Season: 2023 | Generated against candidate scoring rules from `scoring.md`

## C1 — Skill Ceiling

- Top driver: **VER** — 795 pts
- 80th percentile: 344 pts
- Median: 113 pts
- Top-to-median ratio: 7.04x ⚠️ FLAG: >3x target

## C2 — Volatility

Target: single race ≤ 20% of season total. Flagged drivers: 8
  - DEV: max 6 pts = 600.0% of 1
  - MAG: max 10 pts = 100.0% of 10
  - LAW: max 7 pts = 70.0% of 10
  - RIC: max 14 pts = 45.2% of 31
  - OCO: max 25 pts = 31.2% of 80
  - HUL: max 11 pts = 22.9% of 48
  - BOT: max 11 pts = 20.4% of 54
  - PIA: max 37 pts = 20.2% of 183

## C3 — Constructor Strategy

- Races where constructor scored negative: **46**
  - R1 Ferrari: driver_sum=3, penalty=-5, total=-2
  - R1 Alpine: driver_sum=4, penalty=-5, total=-1
  - R1 McLaren: driver_sum=-10, penalty=-5, total=-15
  - R2 Williams: driver_sum=-6, penalty=-5, total=-11
  - R3 Haas F1 Team: driver_sum=0, penalty=-5, total=-5

Model team (top 5 drivers + top 3 constructors, no budget constraint):
  - Driver total: 2343
  - Constructor total: 2556
  - Constructor share: 52.2% ✅ above 25% target

## C4 — No Dominant Always-Picks

Top scorer per race distribution (out of 22 races):
  - VER: 19 races (86%) ⚠️ FLAG: >40%
  - PER: 2 races (9%)
  - SAI: 1 races (5%)

## C5 — Position Gain Calibration

Drivers earning ≥ 20 position-gain pts in a race (P20→P10 threshold): **0**

## C6 — Sprint Weekend Differential

- Sprint weekends: 6 | avg field total pts/round: 229
- Standard weekends: 16 | avg field total pts/round: 178
- Sprint-to-standard ratio: 1.29x
- Main race share of total pts on sprint weekends: 53.0%

## C7 — Captain Pick Variance

Optimal captain distribution (out of 22 races):
  - VER: 19 races (86%) ⚠️ FLAG: >40%
  - PER: 2 races (9%)
  - SAI: 1 races (5%)

## C8 — DNF Penalty Calibration

- Most DNFs: **OCO** (7 DNFs)
  - Season total with penalties: 80
  - Season total without penalties: 150
  - Penalties as % of pre-penalty total: 46.7% ⚠️ FLAG: >30%

All drivers with 3+ DNFs:
  - OCO: 7 DNFs, season total 80
  - SAR: 7 DNFs, season total -23
  - STR: 5 DNFs, season total 147
  - LEC: 5 DNFs, season total 349
  - MAG: 5 DNFs, season total 10
  - ALB: 4 DNFs, season total 72
  - RUS: 4 DNFs, season total 310
  - TSU: 3 DNFs, season total 67
  - SAI: 3 DNFs, season total 339
  - PIA: 3 DNFs, season total 183
  - ZHO: 3 DNFs, season total 66
  - GAS: 3 DNFs, season total 146
  - BOT: 3 DNFs, season total 54

## C9 — Season Runaway Risk

⚠️ NOTE: No budget constraint applied — re-run after pricing is finalized.

### Final season totals
| Scenario | Total pts | vs. locked |
|----------|-----------|------------|
| Locked (race-1 optimal, held all season) | 5477 | — |
| 1 transfer/race | 6208 | +731 |
| 2 transfers/race | 6536 | +1059 |
| Perfect hindsight | 6789 | +1312 |

### Mid-season snapshot (round 12)
| Scenario | Cumulative pts |
|----------|----------------|
| Locked | 3336 |
| 1 transfer | 3526 |
| 2 transfers | 3653 |
| Perfect | 3735 |

Gap from locked to perfect at mid-season: 399 pts
Gap from locked to perfect at season end: 1312 pts
