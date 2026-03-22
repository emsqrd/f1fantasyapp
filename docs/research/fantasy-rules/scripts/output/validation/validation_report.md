# Step 12: Full Model Validation — 2025 Season Replay

## Method

Replayed the 2025 F1 season (24 races) using the complete pricing model:

- **Preseason prices:** Official F1 Fantasy 2025 opening-day prices (from `reference/2025-preseason-prices.csv`)
- **Scoring data:** Per-race scores computed by `simulate.py` against 2025 FastF1 results (from `output/2025/`), including overtake scoring
- **PPM in-season pricing:** All parameters from `decisions/pricing.md`
- **PPM floor at zero:** Race PPM is floored at 0 — negative scores produce 0 PPM rather than negative PPM. This prevents extreme negatives (e.g., DNF at $4.5M → PPM of -2.22) from poisoning the rolling window and creating a one-way floor trap at low prices.

The simulation script (`validate_model.py`) was written from scratch. Price trajectory CSVs are in this directory for further analysis.

### Overtake scoring

Overtakes are detected from FastF1 lap-by-lap position data using pairwise comparison: driver A overtakes driver B when A was behind B on lap N-1 but ahead on lap N, and neither driver pitted on those laps. Lap 1 is excluded (first-lap chaos is already captured by grid-to-finish position change). Each overtake awards +1 point (race and sprint).

**Average overtakes per driver per race: 1–2.5.** The official F1 Fantasy game awards ~3–5 overtake points per driver per race, so our detection is conservative. The pairwise approach avoids phantom gains from retirements and pit stops but may undercount multi-car passes on the same lap.

### Mid-season driver changes

Two mid-season events are handled:

1. **LAW ↔ TSU team swap at R3.** Lawson moved from Red Bull to Racing Bulls; Tsunoda moved from Racing Bulls to Red Bull. The official F1 Fantasy game reset their prices: LAW to $8.4M, TSU to $16.8M. The simulation applies these resets at R3 with fresh PPM windows (2 dummy races at neutral).

2. **DOO → COL replacement at R7 (Alpine).** Colapinto inherited Doohan's current price at entry and started with a fresh PPM window.

---

## Results

### 1. Price Trajectories

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
| COL    | $5.6  | $4.5  | -$1.1  | $4.5  | $5.6  | Y     |
| STR    | $8.1  | $6.9  | -$1.2  | $6.9  | $8.7  |       |
| TSU    | $16.8 | $15.6 | -$1.2  | $9.4  | $16.8 |       |
| BOR    | $6.0  | $4.5  | -$1.5  | $4.5  | $6.0  | Y     |
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
| ALP         | $9.5  | $4.5  | -$5.0  | $4.5  | $9.5  | Y     |

### 2. Floor Compression — PASS

**3 entities at the $4.5M floor at season end.** (DOO excluded — replaced mid-season, not active at season end.)

- Drivers (2): BOR, COL
- Constructors (1): ALP

Target was 2–3. The combination of the PPM floor at zero and overtake scoring resolved the floor compression problem. The PPM floor eliminated the floor trap for entities with mixed form, while overtake points lifted mid-grid and backmarker drivers just enough to keep them out of the Terrible band, preventing the sustained declines that previously pushed entities like GAS, STR, KCK, and HUL to the floor.

The remaining floor entities are either genuine long-term underperformers (BOR) or had too little runway to avoid the floor (COL entered at $5.6M, ALP started at $9.5M but scored poorly all season).

### 3. Team Evolution — PASS

The optimal team (highest expected points under budget) changes meaningfully across 5 checkpoint rounds. **9 total roster changes** across 4 intervals. The optimal team evolves continuously — no set-and-forget roster remains optimal.

### 4. Active Management — PASS

| Metric              | Passive                            | Active                             |
| ------------------- | ---------------------------------- | ---------------------------------- |
| Starting roster     | VER, NOR, SAI, TSU, BEA + HAA, KCK | (same)                             |
| Final roster        | (unchanged)                        | ANT, OCO, RUS, SAI, VER + HAA, MER |
| R1 cost             | $100.0M                            | $100.0M                            |
| End-of-season value | $105.0M                            | $119.5M                            |
| Remaining balance   | $0.0M                              | $12.4M                             |
| Season points       | 2,111                              | 2,569                              |
| Transfers made      | 0                                  | 38                                 |

**Budget advantage: $14.5M.** Points advantage: 458.

The design goal states: "If the budget gap grows large enough to afford an extra elite asset, transfers have become too dominant relative to pick quality." The active manager ends the season with a better-composed team and higher points, but the advantage does not translate into an extra elite asset ($22M+). The active manager's final roster contains one elite entity (VER at $27.8M) — the budget surplus is distributed across better mid-tier picks, not stacked into additional elites.

The active manager uses perfect hindsight (38 of 48 possible transfers, optimal timing), which no real player would replicate. Despite this god-mode strategy, the gap is bounded: active management rewards smart transfers with a better team, but doesn't break roster composition constraints.

### 5. Tier Crossings

**1 crossing in 24 races.** HAM crossed from A-tier to B-tier at R23 ($21.9M).

The $22M tier boundary is effectively static. A-tier entities move at half the rate of B-tier (+$0.1/$0.3 vs +$0.2/$0.6), which is the intended stabilization. But combined with the narrow price changes at A-tier, entities rarely accumulate enough movement to cross the boundary.

This is not inherently a problem — the purpose of the tier boundary is to create different volatility profiles, not to generate crossings. But it's worth noting that the tiered system is functionally a fixed label rather than a dynamic classification.

### 6. Band Distribution — PASS

| Band             | Count | % |
| ---------------- | ----- | - |
| Great (>1.80)    |       | 9%  |
| Good (1.0–1.80)  |       | 30% |
| Poor (0.20–1.0)  |       | 55% |
| Terrible (<0.20) |       | 7%  |

No single band exceeds 60%. Overtake scoring shifted many classifications from Terrible to Poor/Good (Terrible dropped from 13% to 7%). Poor remains the dominant band at 55%, reflecting that most entities score below 1.0 PPM under this price structure.

---

## Summary

| Criterion         | Result   | Notes                                      |
| ----------------- | -------- | ------------------------------------------ |
| Floor Compression | **PASS** | 3 at floor — BOR, COL, ALP (target 2–3)   |
| Team Evolution    | **PASS** | 9 changes across 5 checkpoints             |
| Active Management | **PASS** | $14.5M budget advantage; bounded           |
| Tier Crossings    | INFO     | 0 crossings; tiers are static              |
| Band Distribution | **PASS** | 9% Great, 30% Good, 55% Poor, 7% Terrible |

All validation criteria pass. The combination of the PPM floor at zero and overtake scoring resolved both the floor trap (entities with mixed form can escape the floor after good runs) and floor compression (overtake points lift mid-grid and backmarker scores enough to prevent sustained Terrible-band classifications).

Active management passes — the budget advantage exists but doesn't allow stacking extra elite assets, which is the actual design constraint.

### Known limitations

- **Overtake detection is conservative.** Our pairwise lap-by-lap approach averages 1–2.5 overtakes per driver per race vs the official F1 Fantasy game's ~3–5. The approach misses multi-position gains on a single lap and operates at ~1/20th the temporal resolution of F1's timing-loop system.
- **Scoring is structurally lower than the official game.** We don't include Driver of the Day (+10), use a lower fastest lap bonus (+3 vs +10), lower DNF penalties (-10 vs -20), and have no constructor-specific scoring (pit stops, Q2/Q3 bonuses). This produces a slight deflationary bias — fewer entities appreciate over a season compared to the official game.
- **Tier crossings are effectively zero.** The A-tier half-rate movement combined with narrow step sizes means entities rarely cross the $22M boundary. This is acceptable — the tier system creates different volatility profiles as intended.
