# Scoring Simulation Analysis Report

Season: 2024 | Generated against candidate scoring rules from `scoring.md`

## C1 — Skill Ceiling

- Top driver: **VER** — 670 pts
- 80th percentile: 421 pts
- Median: 71 pts
- Top-to-median ratio: 9.44x ⚠️ FLAG: >3x target

## C2 — Volatility

Target: single race ≤ 20% of season total. Flagged drivers: 12
  - ALB: max 10 pts = 142.9% of 7
  - DOO: max 3 pts = 100.0% of 3
  - LAW: max 13 pts = 81.2% of 16
  - COL: max 7 pts = 77.8% of 9
  - SAR: max 6 pts = 66.7% of 9
  - BEA: max 11 pts = 64.7% of 17
  - OCO: max 32 pts = 43.2% of 74
  - BOT: max 7 pts = 33.3% of 21
  - GAS: max 28 pts = 29.8% of 94
  - TSU: max 19 pts = 28.8% of 66

## C3 — Constructor Strategy

- Races where constructor scored negative: **42**
  - R2 Aston Martin: driver_sum=1, penalty=-5, total=-4
  - R2 Alpine: driver_sum=-5, penalty=-5, total=-10
  - R3 Red Bull Racing: driver_sum=2, penalty=-5, total=-3
  - R3 Williams: driver_sum=2, penalty=-5, total=-3
  - R3 Mercedes: driver_sum=-20, penalty=-10, total=-30

Model team (top 5 drivers + top 3 constructors, no budget constraint):
  - Driver total: 2749
  - Constructor total: 2953
  - Constructor share: 51.8% ✅ above 25% target

## C4 — No Dominant Always-Picks

Top scorer per race distribution (out of 24 races):
  - VER: 10 races (42%) ⚠️ FLAG: >40%
  - LEC: 3 races (12%)
  - NOR: 3 races (12%)
  - SAI: 2 races (8%)
  - RUS: 2 races (8%)
  - HAM: 2 races (8%)
  - PIA: 2 races (8%)

## C5 — Position Gain Calibration

Drivers earning ≥ 20 position-gain pts in a race (P20→P10 threshold): **0**

## C6 — Sprint Weekend Differential

- Sprint weekends: 6 | avg field total pts/round: 234
- Standard weekends: 18 | avg field total pts/round: 176
- Sprint-to-standard ratio: 1.33x
- Main race share of total pts on sprint weekends: 52.6%

## C7 — Captain Pick Variance

Optimal captain distribution (out of 24 races):
  - VER: 10 races (42%) ⚠️ FLAG: >40%
  - LEC: 3 races (12%)
  - NOR: 3 races (12%)
  - SAI: 2 races (8%)
  - RUS: 2 races (8%)
  - HAM: 2 races (8%)
  - PIA: 2 races (8%)

## C8 — DNF Penalty Calibration

- Most DNFs: **ALB** (7 DNFs)
  - Season total with penalties: 7
  - Season total without penalties: 77
  - Penalties as % of pre-penalty total: 90.9% ⚠️ FLAG: >30%

All drivers with 3+ DNFs:
  - ALB: 7 DNFs, season total 7
  - PER: 5 DNFs, season total 248
  - TSU: 4 DNFs, season total 66
  - GAS: 4 DNFs, season total 94
  - STR: 4 DNFs, season total 49
  - COL: 3 DNFs, season total 9
  - HUL: 3 DNFs, season total 89
  - SAI: 3 DNFs, season total 433
  - RUS: 3 DNFs, season total 414

## C9 — Season Runaway Risk

⚠️ NOTE: No budget constraint applied — re-run after pricing is finalized.

### Final season totals
| Scenario | Total pts | vs. locked |
|----------|-----------|------------|
| Locked (race-1 optimal, held all season) | 5785 | — |
| 1 transfer/race | 7131 | +1346 |
| 2 transfers/race | 7363 | +1578 |
| Perfect hindsight | 7465 | +1680 |

### Mid-season snapshot (round 13)
| Scenario | Cumulative pts |
|----------|----------------|
| Locked | 3144 |
| 1 transfer | 3790 |
| 2 transfers | 3944 |
| Perfect | 3988 |

Gap from locked to perfect at mid-season: 844 pts
Gap from locked to perfect at season end: 1680 pts
