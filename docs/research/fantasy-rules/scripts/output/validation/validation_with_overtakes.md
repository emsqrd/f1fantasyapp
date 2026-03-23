# Validation with Overtake Scoring

Experimental re-validation adding overtake points to the scoring model. Not yet a decision — exploring whether this fixes the floor compression problem.

## Change

Added **+1 per on-track overtake** to race and sprint scoring. Overtakes are detected from FastF1 lap-by-lap position data using pairwise comparison: driver A overtakes driver B when A was behind B on lap N-1 but ahead on lap N, and neither driver pitted on those laps. Lap 1 is excluded (first-lap chaos is already captured by grid-to-finish position change).

**Average overtakes per driver per race: 1–2.5.** The official F1 Fantasy game awards ~3–5 overtake points per driver per race, so our detection is conservative. The pairwise approach avoids phantom gains from retirements and pit stops but may undercount multi-car passes on the same lap.

## Results

### Price Trajectories

Start prices reflect each entity's effective starting price (post-reset for entities with mid-season team changes).

#### Drivers

| Driver | Start | End   | Change | Min   | Max   | Floor |
| ------ | ----- | ----- | ------ | ----- | ----- | ----- |
| BEA    | $6.7  | $8.3  | +$1.6  | $6.5  | $8.5  |       |
| LAW    | $8.4  | $9.2  | +$0.8  | $8.0  | $9.2  |       |
| RUS    | $21.0 | $21.8 | +$0.8  | $20.2 | $21.8 |       |
| PIA    | $23.0 | $23.6 | +$0.6  | $22.9 | $24.4 |       |
| HAD    | $6.2  | $6.1  | -$0.1  | $4.5  | $6.5  |       |
| NOR    | $29.0 | $28.6 | -$0.4  | $28.6 | $29.5 |       |
| VER    | $28.4 | $27.8 | -$0.6  | $27.0 | $28.4 |       |
| OCO    | $7.3  | $6.5  | -$0.8  | $4.9  | $7.7  |       |
| HUL    | $6.4  | $5.6  | -$0.8  | $5.2  | $8.8  |       |
| COL    | $5.6  | $4.5  | -$1.1  | $4.5  | $5.6  | \*    |
| STR    | $8.1  | $6.9  | -$1.2  | $6.9  | $8.7  |       |
| TSU    | $16.8 | $15.6 | -$1.2  | $9.4  | $16.8 |       |
| BOR    | $6.0  | $4.5  | -$1.5  | $4.5  | $6.0  | \*    |
| DOO    | $7.2  | $5.6  | -$1.6  | $5.6  | $7.2  |       |
| ANT    | $18.4 | $16.4 | -$2.0  | $14.8 | $19.0 |       |
| LEC    | $25.9 | $23.7 | -$2.2  | $23.7 | $25.9 |       |
| HAM    | $24.2 | $22.0 | -$2.2  | $22.0 | $24.2 |       |
| ALB    | $12.0 | $9.2  | -$2.8  | $9.2  | $12.2 |       |
| SAI    | $13.1 | $9.9  | -$3.2  | $9.1  | $13.1 |       |
| ALO    | $8.8  | $5.6  | -$3.2  | $5.4  | $8.8  |       |
| GAS    | $11.8 | $5.4  | -$6.4  | $5.4  | $11.8 |       |

#### Constructors

| Constructor | Start | End   | Change | Min   | Max   | Floor |
| ----------- | ----- | ----- | ------ | ----- | ----- | ----- |
| HAA         | $7.0  | $11.8 | +$4.8  | $7.0  | $12.0 |       |
| MCL         | $30.0 | $33.6 | +$3.6  | $30.0 | $33.6 |       |
| MER         | $22.7 | $25.3 | +$2.6  | $22.7 | $25.3 |       |
| VRB         | $8.0  | $9.6  | +$1.6  | $6.6  | $9.8  |       |
| RED         | $25.2 | $26.6 | +$1.4  | $25.1 | $26.6 |       |
| AST         | $8.5  | $9.3  | +$0.8  | $7.1  | $11.1 |       |
| FER         | $27.1 | $27.5 | +$0.4  | $26.7 | $27.7 |       |
| KCK         | $6.2  | $6.6  | +$0.4  | $4.6  | $8.6  |       |
| WIL         | $13.1 | $13.1 | $0.0   | $11.1 | $13.5 |       |
| ALP         | $9.5  | $4.5  | -$5.0  | $4.5  | $9.5  | \*    |

### Summary

| Criterion         | Result   | Notes                                     |
| ----------------- | -------- | ----------------------------------------- |
| Floor Compression | **PASS** | 3 at floor — BOR, COL, ALP (target 2–3)   |
| Team Evolution    | **PASS** | 9 changes across 5 checkpoints            |
| Active Management | **PASS** | $14.5M budget advantage; bounded          |
| Tier Crossings    | INFO     | 0 crossings; tiers are static             |
| Band Distribution | **PASS** | 9% Great, 30% Good, 55% Poor, 7% Terrible |

### Active Management Detail

| Metric              | Passive                            | Active                             |
| ------------------- | ---------------------------------- | ---------------------------------- |
| Starting roster     | VER, NOR, SAI, TSU, BEA + HAA, KCK | (same)                             |
| Final roster        | (unchanged)                        | ANT, OCO, RUS, SAI, VER + HAA, MER |
| R1 cost             | $100.0M                            | $100.0M                            |
| End-of-season value | $105.0M                            | $119.5M                            |
| Remaining balance   | $0.0M                              | $12.4M                             |
| Season points       | 2,111                              | 2,569                              |
| Transfers made      | 0                                  | 38                                 |

## Comparison to baseline (without overtakes)

| Criterion         | Without overtakes             | With overtakes               |
| ----------------- | ----------------------------- | ---------------------------- |
| Floor Compression | **FAIL** (6 at floor)         | **PASS** (3 at floor)        |
| Team Evolution    | PASS (11 changes)             | PASS (9 changes)             |
| Active Management | PASS ($16.1M)                 | PASS ($14.5M)                |
| Band Distribution | PASS (55% Poor, 13% Terrible) | PASS (55% Poor, 7% Terrible) |

The main effect: overtake points lift scores for mid-grid and backmarker drivers just enough to keep them out of the Terrible band, preventing the sustained declines that push entities to the floor. Terrible classifications dropped from 13% to 7%.

## Open questions

- Our overtake detection averages 1–2.5/driver/race vs the official game's ~3–5. Is the undercount acceptable, or should the detection be refined?
- The pairwise approach is conservative — it misses multi-position gains on a single lap where one driver passes several cars. A hybrid approach (pairwise + capped net gains) might be more accurate.
- Sprint overtakes are included but sprints are short (~20 laps) so the contribution is small.
