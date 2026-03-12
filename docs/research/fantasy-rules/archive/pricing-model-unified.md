# Unified Pricing Model — Design Brief

**Status:** Starting fresh. Prior exploration in `pricing-model-open-questions.md`.

**Date:** 2026-03-07

---

## Core Insight

Preseason pricing and in-season price changes are not separate problems. They are the same model applied at different points in time:

- **Preseason** = run the model once using the full previous season as input ("race 0")
- **In-season** = run the model after each race using a rolling window of current season data

The model must be consistent across both contexts. Designing them separately creates drift.

---

## What We Know

### 2026 Grid

| Driver            | Team         | 2025 Data?                           |
| ----------------- | ------------ | ------------------------------------ |
| Max Verstappen    | Red Bull     | Yes                                  |
| Isack Hadjar      | Red Bull     | Yes (Racing Bulls) — team upgrade    |
| Lando Norris      | McLaren      | Yes                                  |
| Oscar Piastri     | McLaren      | Yes                                  |
| George Russell    | Mercedes     | Yes                                  |
| Kimi Antonelli    | Mercedes     | Yes                                  |
| Charles Leclerc   | Ferrari      | Yes                                  |
| Lewis Hamilton    | Ferrari      | Yes                                  |
| Carlos Sainz      | Williams     | Yes                                  |
| Alexander Albon   | Williams     | Yes                                  |
| Fernando Alonso   | Aston Martin | Yes                                  |
| Lance Stroll      | Aston Martin | Yes                                  |
| Nico Hulkenberg   | Audi         | Yes (was Kick Sauber → Audi rebrand) |
| Gabriel Bortoleto | Audi         | Yes (was Kick Sauber → Audi rebrand) |
| Esteban Ocon      | Haas         | Yes                                  |
| Oliver Bearman    | Haas         | Yes                                  |
| Pierre Gasly      | Alpine       | Yes                                  |
| Franco Colapinto  | Alpine       | Yes                                  |
| Liam Lawson       | Racing Bulls | Yes                                  |
| Arvid Lindblad    | Racing Bulls | No — rookie                          |
| Sergio Perez      | Cadillac     | No — was absent in 2025              |
| Valtteri Bottas   | Cadillac     | No — was absent in 2025              |

| Constructor  | Notes                                                  |
| ------------ | ------------------------------------------------------ |
| Red Bull     | Unchanged                                              |
| McLaren      | Unchanged                                              |
| Mercedes     | Unchanged                                              |
| Ferrari      | Unchanged                                              |
| Williams     | Unchanged                                              |
| Aston Martin | Unchanged                                              |
| Audi         | Rebranded from Kick Sauber — use 2025 Kick Sauber data |
| Haas         | Unchanged                                              |
| Alpine       | Unchanged                                              |
| Racing Bulls | Unchanged                                              |
| Cadillac     | New team — no prior data                               |

### Drivers with no 2025 data → floor price

- Lindblad (rookie)
- Perez (absent in 2025)
- Bottas (absent in 2025)

### Team changes that may misprice drivers

- Hadjar: Racing Bulls → Red Bull (was in weaker car, now in top car)

### Rebrands (same physical team, different name — use same constructor data)

- Kick Sauber → Audi (Hulkenberg + Bortoleto stay)

---

## What We Want the Model to Do

1. **Produce differentiated prices** across the full grid — not half the field at the floor
2. **Force meaningful budget tradeoffs** — a valid team shouldn't be able to afford more than 2 top drivers
3. **Be consistent** — same logic preseason and in-season, same logic for drivers and constructors
4. **Be explainable** — players should understand why prices move

---

## What We've Learned

### Formula exploration

- **Power curve** (`FLOOR + (CEILING - FLOOR) × normalised^SHAPE`): current implementation, collapses mid-field at floor
- **Multiplier** (`k × per_race_avg`): no ceiling, calibrated by setting a target price for VER. Produces better spread but also clusters at floor for backmarkers
- At **$6M floor**: too many drivers collapse to floor regardless of formula
- At **$3M floor**: grid is differentiated but floor slots feel too cheap — not meaningful budget decisions

### Budget cap exploration (using 2025 data, multiplier formula)

| VER target | Floor | Cap   | Dream picks | Optimal drivers |
| ---------- | ----- | ----- | ----------- | --------------- |
| $22M       | $3M   | $100M | 4/8         | VER, NOR, RUS   |
| $24M       | $3M   | $100M | 3/8         | VER, NOR        |
| $26M       | $3M   | $100M | 3/8         | RUS only        |

- User goal: no more than 2 top drivers in a valid team
- $24M VER target came closest but the optimal team composition shifted unexpectedly at $26M

### F1 Fantasy in-season mechanism (reverse-engineered, 2025)

Source: f1fantasytools.com

- Two price tiers: **A-Tier (≥$19M)** and **B-Tier (<$19M)**
- Performance measured by **AvgPPM** (rolling average points per million)
- Thresholds: Great >1.2, Good 0.9–1.2, Poor 0.6–0.9, Terrible <0.6
- Price changes: A-Tier ±0.1/0.3M, B-Tier ±0.2/0.6M
- **Neutral point is 0.9 PPM** — above = price rises, below = drops
- Known flaw: B-Tier drivers average 0.388 PPM historically → systematically lose value all season

### The unification insight

The F1 PPM approach and our multiplier approach are both fundamentally PPM-based. The multiplier formula is `price = k × avg_pts`, which means `avg_pts / price = 1/k` — a constant PPM target. The model is already unified in structure; the question is how to implement it consistently.

---

## Open Questions for Next Session (RESOLVED)

1. **What is the right PPM neutral point?** ✅ Not needed. Power curve implicitly defines it (target = formula output for current rolling avg)
2. **How do we handle the floor?** ✅ $6M works — with constructor context (below), only rookies collapse to floor, midfield is differentiated
3. **How do we handle team changes and rookies?** ✅ Constructor-context adjustments (see below)
4. **Rolling window size?** ✅ 3 races with dummy seeding (see below)
5. **Price change magnitude?** ✅ Keep continuous ±10% movement — cleaner than fixed steps
6. **Cap validation** — ⚠️ Reopened. See budget cap section below.

---

## Resolution Session — Constructor Context & Dummy Seeding (2026-03-07 continued)

### The Problem

Player teams fall behind (SAI trap: $14.4M for Williams rookie) or jump ahead (ANT value: $6M Mercedes rookie) by the time dynamic pricing corrects in races 4-6. Early season advantage is season-deciding in a 24-race season.

### The Solution: Constructor-Context Preseason Pricing

**For rookies:** Price at constructor's per-driver average (not floor)

- Antonelli at Mercedes (per-driver avg 16.50): **$13.3M** instead of $6M floor
- Significantly reduces auto-include value abuse
- Applies equally to all rookies — transparent and rule-based

**For team changers:** Blend individual 2024 avg with new team's per-driver avg at α=0.5

- SAI (Ferrari → Williams): 0.5 × 18.83 + 0.5 × (-1.19) = 8.82 → **$9.9M** instead of $14.4M
- Reduces overprice traps significantly
- At α=0.5, avoids both overshooting and undershooting

**Calculation:** `adjusted_avg = α × individual_2024_avg + (1-α) × new_team_per_driver_avg`

Where `new_team_per_driver_avg` = average of both drivers' 2024 individual per-race averages for that constructor (not constructor_score/2, which excludes qualifying).

### Results (2025 data validation)

Total grid preseason mispricing:

- Current power curve ($6M floor): $30.4M
- Constructor context (α=0.5): **$25.4M** — 17% reduction
- Largest single mispricing drops from SAI at $6.2M to LEC at $3.0M (same-team driver)

### In-Season Correction: Dummy Race Seeding (replaces frozen period)

**Mechanism:** Seed the 3-race rolling window with 2 "dummy" entries equal to the driver's preseason per-race average.

- After R1: window = [dummy, dummy, R1_actual]
- After R2: window = [dummy, R1, R2]
- After R3+: window = [R(n-2), R(n-1), Rn] — fully real data
- Same ±10% price cap per round
- No frozen period needed

**Advantages over frozen period:**

- No special "frozen" rule in the ruleset
- Constant 3-race window all season (same volatility structure)
- Preseason anchor fades naturally as real data accumulates
- First corrections start after R1 (not R4), but with dampening

**Mispricing comparison (R1-R8 average):**

- Frozen 3: $20.5M
- **Dummy seeding: $18.5M** (2% better, no mid-season volatility increase)
- Stability identical at R4+ ($0.7M avg change/round)

### Known Issues & Limitations

1. **Constructor per-driver avg skew:** Teams with dominant #1 drivers (e.g., Red Bull: VER 27.92 vs PER 10.33 = 19.13 avg) inflate expectations for incoming drivers. For TSU replacing PER: 0.5 × 2.75 + 0.5 × 19.13 = 10.94 → $12M estimate vs fair $8.8M (+$0.6M overshoot). Acceptable as noise-level error but worth documenting.

2. **Mid-season swaps not predicted:** TSU didn't change teams at preseason (Racing Bulls→Red Bull happened after R2). Mid-season swaps are handled by dynamic pricing only; preseason can't predict them.

3. **Rookie discount not applied:** Rookies priced at team per-driver average assumes they'll match experienced drivers. ANT's price from team avg 16.50 would be $13.3M (fair $10.8M). Constructor context mitigates but doesn't fully solve. ANT's 2025 season (260 pts) validated the current approach — see Future Refinements for further investigation plan.

4. **P4 validation criterion failure:** The P4 criterion ("≥3 floor-priced entities with positive season score") was designed to confirm that floor-priced picks represent genuine value, not mispriced rookies. Under constructor-context pricing, only Williams constructor reaches the $6M floor — the criterion returns 1 entity, not 3. The criterion was implicitly relying on mispriced rookies to pass. P4 needs to be redesigned — e.g., "≥3 entities priced below $X with positive score" using a threshold above the floor (e.g., $8M).

---

## Budget Cap Re-validation (2026-03-07, post qualifier-inclusive constructor scoring)

Including qualifying in constructor scoring raised constructor prices for the top teams:

| Constructor | Old price (race/sprint only) | New price (incl. qualifying) | Change |
| ----------- | ---------------------------- | ---------------------------- | ------ |
| McLaren     | $23.1M                       | $25.0M                       | +$1.9M |
| Red Bull    | $19.7M                       | $21.5M                       | +$1.8M |
| Mercedes    | $18.0M                       | $19.4M                       | +$1.4M |

This pushed the dream team cost up ~$5M. The previously validated $100M cap now produces **146.5% tightness** — outside the 125–140% target range.

| Cap   | Tightness | Status           |
| ----- | --------- | ---------------- |
| $100M | 146.5%    | ⚠️ Above target  |
| $110M | 133.2%    | ✅ Within target |
| $115M | 127.4%    | ✅ Within target |
| $120M | 122.1%    | ⚠️ Below target  |

Dream team (2025 data): VER $18.4M + NOR $17.0M + LEC $16.3M + PIA $15.2M + RUS $13.7M + McLaren $25.0M + Red Bull $21.5M + Mercedes $19.4M = **$146.5M**

**Options:**

1. **Raise cap to $110M** — stays within target (133.2%), minimal model change
2. **Lower constructor ceiling** — bring constructor prices down to restore $100M viability, requires recalibrating parameters
3. **Keep $100M and accept 146.5% tightness** — model still produces meaningful tradeoffs, just tighter than originally targeted

**Decision:** $100M. Tightness of 146.5% is above the original 125–140% target but accepted for now — revisit if it feels too restrictive in actual play.

---

## Final Model Parameters

| Parameter              | Value                      | Notes                                                     |
| ---------------------- | -------------------------- | --------------------------------------------------------- |
| Preseason formula      | Power curve                | shape=1.0                                                 |
| Driver floor           | $6M                        | Rookie minimum; midfield differentiated                   |
| Driver ceiling         | $19M                       |                                                           |
| Constructor floor      | $6M                        |                                                           |
| Constructor ceiling    | $25M                       |                                                           |
| REF_MAX (driver)       | 29.29 pts/race             | VER 2024 baseline                                         |
| REF_MAX (constructor)  | 45.25 pts/race             | McLaren 2024 baseline (incl. qualifying)                  |
| Budget cap             | $100M                      | 146.5% tightness — above 125–140% target but accepted; revisit if it feels off in play |
| Team context blend (α) | 0.5                        | For team changers: 50% individual, 50% team               |
| Rookie pricing         | Team per-driver avg        | No individual history; priced at new constructor's per-driver avg (α=0 for individual component) |
| Rolling window         | 3 races                    | Seeded with 2 dummy entries preseason                     |
| Price change cap       | ±10% per round             | Continuous movement toward target                         |
| In-season target       | Power curve on rolling avg | Same formula as preseason                                 |

---

## Validation Scripts

All findings validated via simulation against 2025 season data. Scripts available in `simulation/`:

1. **`model_comparison.py`** — Power curve vs multiplier formula bakeoff
   - Compares differentiation, PPM spread, optimal team composition
   - Shows power curve (14/21 drivers differentiated) beats multiplier (9/21)
   - Validates $6M floor + power curve is superior to multiplier at any floor

2. **`context_pricing_comparison.py`** — Constructor-context preseason pricing
   - Tests α values (0.0 to 1.0) for team-changer blending
   - Shows α=0.5 optimal for reducing mispricing variance
   - Demonstrates rookie pricing by team avg (ANT $10.9M vs fair $10.8M)
   - Compares early-season correction speed vs stability

3. **`correction_speed_comparison.py`** — In-season correction approaches
   - Frozen 3 vs Frozen 2 vs Frozen 1 (expanding window) vs Dampened early caps
   - Shows all approaches converge at R4+ with $0.7M avg volatility
   - Validates frozen period is no longer critical given context pricing

4. **`dummy_race_comparison.py`** — Dummy race seeding validation
   - Shows dummy seeding produces R1-R8 avg mispricing of $18.5M (vs $20.5M frozen 3)
   - Confirms R4+ volatility identical ($0.7M avg, $1.9M max)
   - Demonstrates smooth price transition for individual drivers (ANT, SAI, TSU)
   - Validates preseason anchor naturally fades as real data accumulates

**To run validation:** `python3 simulation/dummy_race_comparison.py` (or other scripts)
**Data sources:** `simulation/output/2025/` (driver/constructor season totals, race-by-race scores)

### Resolved: Constructor Per-Driver Average

Previously, the four context-pricing scripts computed `constructor_avg / 2` as a proxy for per-driver average, which underestimated because constructor scoring excluded qualifying. This was resolved by updating constructor scoring to include qualifying points (constructor score = sum of both drivers' full fantasy points). With this change, `constructor_avg / 2` closely approximates the per-driver average (the only remaining gap is the constructor DNF penalty).

---

## Future Refinements

### Multi-Season Lookback for Established Drivers

**Status: Investigated and rejected.** See `simulation/multi_season_lookback.py` for full analysis.

**Observation:** F1 Fantasy prices Albon $12M for 2025 start vs our model's $6.1M (near floor). The gap prompted investigation into multi-season lookback as a formulaic fix.

**Simulation results (2022–2025 data):**
- For 2025 preseason: single-season (2024 only) is the *best* option — every lookback combination increases mispricing
- For 2024 preseason: lookback helps ($6.4M improvement) but with inverted weights (0.25/0.75 heavily favouring older data), which isn't a stable pattern
- Combined across both seasons: best 2-year weights save only $1M total — noise-level improvement

**Why lookback doesn't solve ALB:** His career at Williams was consistently poor across all available seasons (2022: -3.86 avg, 2023: 3.27 avg, 2024: 0.29 avg). No weighted blend gets close to his 2025 actual (6.04 avg). The 2025 jump reflects a car improvement that cannot be predicted from any backward-looking data.

**Root cause:** ALB's multi-year depressed scoring is significantly driven by DNF frequency (12 DNFs in 2022, 7 in 2024) which the -10 penalty compounds harshly. Without penalties: 2022 = 1.86 avg, 2024 = 3.21 avg — a much smoother curve, but still well below his 2025 actual.

**The F1 Fantasy gap:** F1 Fantasy's $12M preseason price is almost certainly editorial — incorporating forward-looking signals (Sainz joining Williams, team investment trajectory, driver reputation) that no backward-looking formula can replicate.

**Known limitation accepted:** ALB-style cases (proven driver, consistently poor car, sudden improvement) will be mispriced at preseason. This is accepted as a feature rather than a bug — savvy players who spot underpriced known-good drivers are rewarded. Dynamic pricing corrects within 2–3 races once real data accumulates. The only genuine quirk is ordering (ALB behind rookies like Bortoleto preseason), which is also accepted.

---

### Constructor Lineup-Change Adjustment

**Status: Investigated and rejected.** See `simulation/constructor_lineup_adjustment.py` for full analysis.

**Observation:** Constructor preseason prices are based on the prior season's constructor avg, which includes contributions from drivers who may have departed. When Mercedes replaces Hamilton (15.75 avg/race) with rookie Antonelli, the 2025 constructor price ($19.4M) still reflects Hamilton's output. The price doesn't account for the known lineup change.

**Approach tested:** Adjust the constructor's preseason avg by replacing the departed driver's per-race contribution with the incoming driver's expected avg. Three estimation methods for incoming drivers were compared:

- **Scenario A** — Individual 2024 avg; rookies estimated at staying driver's avg
- **Scenario B** — Individual 2024 avg; rookies estimated at team per-driver avg
- **Scenario C** — Context-blended avg (α=0.5 for team changers, team per-driver avg for rookies)

**Results (2024→2025, 8 of 10 constructors had lineup changes):**

| Approach | Total constructor mispricing | vs Current |
|----------|----------------------------|------------|
| Current model (no adjustment) | $17.6M | — |
| Scenario A (rookie → staying driver avg) | $17.4M | $0.2M better |
| Scenario B (rookie → team avg) | $14.7M | $2.9M better (16%) |
| Scenario C (context α=0.5) | $15.0M | $2.6M better (15%) |

**Per-constructor findings:**

- The largest single constructor error was Ferrari at $5.4M — driven by car performance regression (constructor avg 40.79 → 27.75), not the SAI→HAM lineup swap. The adjustment reduced this to $4.5M under Scenarios A/B but could not address the car-level decline.
- Red Bull (PER→TSU): error reduced from $2.0M to $1.1M under Scenarios A/B. Scenario C worsened it to $2.2M because the α=0.5 blend inflated TSU's estimate with Red Bull's high per-driver avg.
- Williams (SAI arriving): Scenarios A/B overcorrected — flipping from $3.7M underpriced to $3.2M overpriced (SAI's Ferrari-era avg of 18.83 was far above his Williams output of 4.88/race). Scenario C handled this best ($0.9M error) because the blend tempered SAI's individual avg with Williams' low per-driver avg.
- Haas (HUL+MAG out, OCO in): all scenarios made pricing worse ($1.8M → $3.2–3.3M error) because Haas's car improved in 2025 — a factor the adjustment cannot capture.
- Mercedes (HAM→ANT): current model already near-perfect ($0.1M error) because Antonelli outperformed rookie expectations. Scenarios B/C improved to $0.0M; Scenario A worsened to $0.5M.

**Direction analysis (Scenario B):** Moved prices in the correct direction for 6 of 8 changed constructors. Worsened 1 (Haas). Tied on 1 (Alpine). No single scenario was best for all constructors.

**Decision: Not implementing.** The best scenario (B) reduces total constructor mispricing by $2.9M (16%), averaging $0.36M per constructor. The largest constructor errors are driven by car performance changes between seasons, which no lineup-based adjustment can address. The mechanism adds a constructor-specific adjustment rule without consistently improving pricing across constructors.

---

### In-Season Volatility Cap

**Observation:** The current ±10% per-round price cap allows large swings in short periods. Mercedes dropped $10.7M (from $23.8M to $13.1M) over 10 rounds in 2025. While the cap was actively limiting the drop (without it the swing would be worse), the volatility still creates a poor player experience — a player who buys at the R4 peak faces a $10.7M asset depreciation that crushes their budget flexibility for the rest of the half-season, even if they made a reasonable decision at the time.

The "dynamic pricing self-corrects" argument doesn't hold from a player perspective: a price that's wrong at R8 actively misleads a player making an R8 decision, regardless of whether it's right by R16.

**Directions to explore:**

1. **Lower the cap globally** — reducing from ±10% to ±5% or ±7% smooths week-to-week swings but also slows correction toward fair value. Needs simulation to find the right balance.

2. **Constructor-specific lower cap** — constructors are composite entities (two drivers + car). One driver underperforming shouldn't drag the constructor price down as hard as that driver's individual price drops. For example, ANT underperforming at Mercedes should dip ANT's price significantly, but Mercedes' constructor price has RUS's performance to offset it — the constructor price should move more slowly in both directions. A separate (lower) cap for constructors reflects this structural difference.

3. **Asymmetric cap** — allow faster upward movement (rewarding performance) than downward (protecting players from extreme depreciation). This adds complexity but may feel fairer to players.

**Key question:** The volatility cap and rolling window length are related. A longer window (e.g., 5 races) naturally dampens volatility without a tighter cap, but at the cost of responsiveness. Explore both levers together before deciding.

---

### Price Ceiling Design

**Status: Investigated.** See `simulation/ceiling_design_comparison.py` for full analysis.

**Observation:** The current ceiling is a hard clamp — once an entity reaches the ceiling, its target price is capped regardless of how much its rolling average exceeds REF_MAX. This has two consequences:

1. **Price signal goes silent at the top.** Two entities at the ceiling could have very different rolling averages (one genuinely ceiling-level, one 30% above it) but players see the same price and the same $0 week-to-week change. The most informative signal in the model — price movement — is dead for ceiling-pinned entities.

2. **Other entities can't rise past the ceiling.** An entity slow-building to the ceiling mid-season hits it and freezes. A dominant entity that would "deserve" a higher price in absolute terms has no way to express that. In practice this means REF_MAX calibration is doing double duty: it sets the price curve shape *and* implicitly determines which entities get pinned at the ceiling.

**Quantified impact (2025 simulation):**

- McLaren pinned at the $25M constructor ceiling for **16 of 24 rounds** — zero price signal for two-thirds of the season
- VER pinned at the $19M driver ceiling for 7 rounds, PIA for 8, NOR for 5
- Total: 20 driver entity-rounds and 19 constructor entity-rounds with dead price signal
- 47 driver entity-rounds and 20 constructor entity-rounds with zero price movement

**Approaches tested:**

| Approach | D pinned rounds | C pinned rounds | DT cost | Tightness | D spread |
|---|---|---|---|---|---|
| Current (hard clamp) | 20 | 19 | $146.5M | 146.5% | $4.2M |
| Raised ceiling (D $22M, C $29M) | 20 | 19 | $168.0M | 168.0% | $5.1M |
| Soft ceiling (asymptotic) | 0 | 0 | $146.5M | 146.5% | $4.2M |
| Decoupled REF_MAX (×1.3) | 0 | 6 | $123.7M | 123.7% | $3.2M |

**Key findings:**

1. **Raised ceiling doesn't solve pinning.** Pinned rounds remain identical (20/19) because the normalisation still clamps at `avg/REF_MAX = 1.0` — it just raises the price entities get pinned at. Dream team cost blows up to 168–184% of budget cap.

2. **Soft ceiling eliminates all pinning.** Zero pinned rounds for both drivers and constructors. Prices continue to rise above the nominal ceiling with diminishing returns. Preseason prices, dream team cost, and budget tightness are completely unchanged — the soft zone only activates in-season when rolling averages exceed REF_MAX.

3. **Decoupled REF_MAX collapses the price spread.** Using a higher curve_ref squishes all prices down (not just top entities). Tightness drops to 113–124%, below the 125–140% target.

**McLaren under soft ceiling (softness=0.5):** Instead of flat at $25M for 16 rounds, prices ranged from $18.6M to $27.9M with movement every round. Peak rolling averages for entities that exceeded REF_MAX:

| Entity | Peak 3-race avg | % above REF_MAX | Soft ceiling peak price |
|---|---|---|---|
| McLaren | 68.67 | +51.7% | $27.9M |
| Mercedes | 55.33 | +22.3% | $26.6M |
| Red Bull | 49.67 | +9.8% | $25.8M |
| VER | 38.67 | +32.0% | $20.6M |
| PIA | 37.33 | +27.5% | $20.4M |
| NOR | 35.33 | +20.6% | $20.1M |

**Connection to volatility cap:** The ceiling pinning problem and the volatility problem share a root cause — the ±10% per-round movement cap is percentage-based, which means it compounds. A $25M entity moves ±$2.5M per round. By contrast, the official F1 Fantasy game uses fixed dollar movements (A-Tier: max ±$0.3M, B-Tier: max ±$0.6M) — 8× smaller for top entities and non-compounding.

If per-round movement is changed from percentage-based to fixed-dollar (or significantly reduced), two things happen:
- **Ceiling pinning partially solves itself** — prices approach the ceiling slowly enough that rolling average fluctuations pull them back before they get pinned
- **The hard cap becomes unnecessary** — fixed-dollar movement can't compound, so the maximum possible season-long drift is bounded by `step_size × number_of_rounds` (e.g., $0.3M × 24 = $7.2M)

**The F1 Fantasy precedent:** The official game uses fixed-dollar movements (A-Tier max ±$0.3M, B-Tier max ±$0.6M per round) — 8× smaller than our ±10% for top entities. Combined with their PPM-based performance classification (neutral point 0.9 PPM, tied to current price), this structure creates a self-limiting system: expensive entities move little, cheap entities move more. The official game doesn't need an explicit hard cap because the arithmetic bounds the drift. Over 24 races with max ±$0.3M steps, the absolute worst-case price swing is $7.2M — already accounted for in team planning.

**Strategic question:** Would adopting a fixed-dollar, PPM-based movement model (similar to F1 Fantasy) eliminate the need for a hard cap entirely? The advantages would be:
- **No cap needed** — arithmetic self-limits maximum drift
- **Simpler rules** — one movement model for all entities instead of tiered caps
- **More intuitive** — players know a top entity moves $0.3M max, period
- **Reduced complexity** — no hard/soft ceiling debate, no REF_MAX calibration effects, no compounding issues

The tradeoff: would fixed-dollar movement feel too restrictive? Would correction speed toward fair value slow unacceptably? This needs simulation against our 2025 data to validate.

**Decision: Defer ceiling-specific changes.** The soft ceiling is the technical winner for a percentage-based model. But exploration of a fixed-dollar PPM-based model (informed by F1 Fantasy's proven approach) might be the better long-term direction — it solves ceiling, volatility, and cap design in one unified mechanism. Priority: investigate volatility cap and movement magnitude, which will inform the broader model choice.

---

### Explicit Rookie Discount

**Status: Investigated and deferred.** See `simulation/rookie_discount_analysis.py` for full analysis.

**Observation:** Current approach prices rookies at their new team's per-driver avg, which may overprice rookies in top seats. ANT was priced at $13.1M (Mercedes per-driver avg) despite zero F1 experience.

**Simulation results (2022–2025 data, 11 rookies across 3 season transitions):**

A discount factor `d` is applied to the team per-driver avg before feeding it into the power curve: `adj_avg = team_per_driver_avg × d`.

| Discount | Total mispricing | vs No discount |
|----------|-----------------|----------------|
| No discount (d=1.0) | $12.1M | — |
| d=0.90 | $11.6M | $0.5M better (4%) |
| d=0.80 | $11.1M | $1.0M better (8%) |
| d=0.75 | $10.8M | $1.3M better (11%) |
| **d=0.70** | **$10.7M** | **$1.4M better (12%)** |
| d=0.60 | $11.3M | $0.8M better (7%) |
| d=0.50 | $12.4M | $0.3M worse |

Optimal discount is d=0.70, but the improvement is driven almost entirely by a single case: ANT at Mercedes (actual performance = 68% of team per-driver avg). The remaining 10 rookies were at teams with per-driver avg ≤ 3 pts/race — already near the $6M floor where a discount has no effect.

**Rookie performance ratios (actual / team per-driver avg):**

| Tier | n | Mean ratio | Std dev | Cases |
|------|---|------------|---------|-------|
| TOP (avg > 10) | 1 | 68% | — | ANT |
| MID (3 < avg ≤ 10) | 1 | 260% | — | PIA |
| BACK (avg ≤ 3) | 4 | 101% | — | RIC, BOR, BEA, DOO |

Overall: mean 122%, median 124%, std dev 105%. No stable pattern emerges — PIA outperformed his team context by 2.6×, while ANT underperformed at 0.68×.

**Early-season correction neutralises the discount:** Simulating ANT's R1–R8 price evolution with dummy seeding shows all discount levels converge to the same price ($9.9M) by R8. The ±10% per-round cap erases the preseason price difference within 3–5 races, limiting the discount's impact to the R1–R3 window.

**2026 impact is marginal:** The only 2026 rookie (Lindblad at Racing Bulls, team avg 3.52 pts/race) would move from $7.6M to $7.1M at d=0.70 — a $0.5M difference near the floor. PER and BOT at Cadillac (new team, no prior data) are at the floor regardless.

**Decision: Not implementing.** The optimal discount (d=0.70) is fitted to n=1 for the only case where it materially changes the price (rookie at a top team). The 105% std dev in rookie ratios means any fixed discount is as likely to worsen pricing as improve it for the next case. The in-season correction mechanism renders the preseason difference short-lived. Revisit when a second top-team rookie provides a calibration data point.

---

## Status

✅ **Model is unified and validated against 2025 data. All parameters resolved.**

- Preseason prices reflect team context for rookies & changers
- In-season correction uses same formula structure
- No frozen period; constant window with natural transition
- Constructor scoring now includes qualifying (sum of both drivers' full fantasy points)

**Known broken:** P4 validation criterion fails under context pricing — needs redesign (see Known Issues #4).

**Future refinements to investigate:**

- ~~Multi-season lookback for established drivers (addressing ALB-style mispricing in poor-car seasons)~~
- ~~Constructor lineup-change adjustment (investigated — best scenario reduces total constructor mispricing by 16% / $2.9M, but largest errors are car-performance-driven, not lineup-driven; mechanism adds complexity without consistent improvement)~~
- ~~Explicit rookie discount to constructor-context pricing (investigated — optimal d=0.70 fitted to n=1 case; 105% std dev in rookie ratios; in-season correction neutralises preseason difference within 3–5 races)~~
- ~~Price ceiling design (investigated — soft ceiling eliminates all pinning while preserving preseason prices and budget tightness; however, ceiling and volatility problems share a root cause in ±10% compounding movement; deferred pending volatility cap resolution)~~
- In-season volatility cap — **next priority.** The ±10% percentage-based movement is the root cause of both ceiling pinning and mid-season volatility. Explore switching from percentage to fixed-dollar movement (informed by F1 Fantasy's ±$0.3M/$0.6M tiered approach). Fixed-dollar movement eliminates compounding, naturally limits ceiling approach speed, and may remove the need for a hard price cap entirely. Must simulate to find the right step sizes for our scoring model and validate that correction speed toward fair value remains acceptable.
