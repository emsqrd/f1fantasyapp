# Direction-Based Pricing Model — Research Brief

**Status:** Exploring. Follows from `pricing-model-unified.md`.

**Date:** 2026-03-09

---

## Origin

The unified model (`pricing-model-unified.md`) concluded with the power curve as the validated approach and deferred ceiling/volatility issues to a future investigation. This document picks up that thread and explores a fundamentally different model architecture.

The trigger was a philosophical objection to the current model's core assumption.

---

## The Core Problem with Target-Based Pricing

The current model works like this:

1. Compute a per-race rolling average for each entity
2. Feed that into the power curve to get a **target price**
3. Move the current price ±10% toward that target each round

The problem: **the target price is not a known truth.** It is a formula output. The power curve defines the target, and the system then chases its own definition. There is no external oracle saying what VER's price should be — the model invents a target and then treats the gap between current price and that invented target as an error to correct.

Worse, the target itself is anchored to a specific historical reference point. The power curve normalises against REF_MAX — VER's 2024 per-race average (29.29 pts/race) for drivers, McLaren's 2024 average (45.25 pts/race) for constructors. These values determine where the ceiling price is awarded. If 2026's dominant performer exceeds those baselines, the formula underestimates their target price and ceiling-pins them. If 2026's grid performs below those baselines, the formula overestimates targets across the board. The "correct" price the model is chasing is not just invented — it is anchored to a different season's performance distribution.

This matters for players: a player making a decision at R8 is looking at a price that the model itself considers wrong (it has an internal target that differs). The displayed price is in transit — "on its way to somewhere else." The player is using a lagging, incomplete signal.

The ±10% cap compounds this: if the target is far from the current price, the model knows prices should change significantly but can only move them slowly. The "lag toward a phantom target" is a poor contract with the player.

### The criterion this fails

> Round-to-round accuracy needs to be as highly accurate as possible. In-season price should reflect current value, not future value after correction completes.

A target-based model cannot satisfy this criterion by design. While it may self-correct over the length of a season, the path to correction is the problem — players making weekly decisions during that correction window are working with prices the model itself knows are wrong.

---

## The Direction-Based Alternative

A direction-based model makes a weaker — and more defensible — claim:

> We don't know what this entity's price should be. We only know whether it is currently delivering good value for what it costs.

**Mechanism:** After each race, compute each entity's PPM (points ÷ price in millions) over a rolling window. Compare to a neutral point. If above neutral, price rises by a fixed dollar amount. If below, price falls.

**What changes:**

- No target price is ever computed
- No power curve in-season
- Price after R8 reflects 8 rounds of accumulated performance-relative-to-cost signals
- There is no "backlog of correction" waiting to happen
- The displayed price IS the price — no hidden state

**What stays the same:**

- Preseason pricing still needs a formula to seed initial prices (see below)
- Rolling window still applies
- Floor still applies

---

## PPM Explained

**PPM = points scored ÷ price in millions**

The same score means different things at different price levels:
- 20 pts at $20M = 1.0 PPM (neutral — correctly priced)
- 20 pts at $10M = 2.0 PPM (excellent — underpriced, price should rise)
- 20 pts at $40M = 0.5 PPM (poor — overpriced, price should fall)

The **neutral point** is the PPM at which an entity is considered correctly priced — neither rising nor falling is warranted. F1 Fantasy uses 0.9 PPM. Our model would need to calibrate this independently (see Open Questions).

**Why current price is part of the signal:** As an entity's price rises from repeated strong performance, its PPM falls (same points, higher denominator). This creates a natural self-limiting feedback loop — prices don't rise indefinitely because rising prices reduce PPM, which eventually moves the entity into neutral or declining territory.

---

## F1 Fantasy Reference Implementation

Source: F1 Fantasy Tools (Patreon, March 2025). Reverse-engineered from 2025 season data. Not officially published by F1.

### Mechanism

Two price tiers based on current price:
- **A-Tier** (≥$19M): smaller movements
- **B-Tier** (<$19M): larger movements

PPM calculated from a **3-race equally-weighted rolling average**. Classified into four performance bands:

| AvgPPM | Performance | A-Tier | B-Tier |
|--------|-------------|--------|--------|
| > 1.2  | Great       | +$0.3M | +$0.6M |
| 0.9–1.2 | Good       | +$0.1M | +$0.2M |
| 0.6–0.9 | Poor       | −$0.1M | −$0.2M |
| < 0.6  | Terrible    | −$0.3M | −$0.6M |

Neutral point: **0.9 PPM** — above it prices rise, below it prices fall.

### Key properties

- **Fixed-dollar steps, not percentages.** No compounding. A $25M constructor and a $19M one both move ±$0.3M max.
- **Maximum season drift is bounded by arithmetic:** step × rounds. At ±$0.3M × 24 races = $7.2M absolute worst case. No hard ceiling needed.
- **Expensive entities move less.** A-Tier max ±$0.3M vs B-Tier max ±$0.6M. A natural limit on how fast top entities approach any price boundary.
- **PPM ties performance to current price.** The same score is evaluated differently as price changes — the mechanism is self-correcting.

---

## Known Issues with F1's Implementation

These are structural flaws in F1's specific calibration, not flaws in the direction-based approach itself. They inform what to avoid in our own calibration.

### 1. Neutral point too high for B-Tier drivers

Average B-Tier driver PPM in 2024: **0.388** — permanently below the 0.6 "Terrible" threshold. B-Tier drivers lost $0.6M nearly every round regardless of relative performance within their tier. The neutral point of 0.9 PPM is miscalibrated for lower-priced entities.

**Implication for us:** A single neutral point may not work across our full price range. Separate thresholds for drivers vs constructors, or for different price bands, may be necessary.

### 2. A-Tier constructors systematically inflate

Average A-Tier constructor PPM in 2024: **2.310** — permanently above 1.2 "Great." A-Tier constructors gained +$0.3M in 90 of 96 round-changes (94%). Constructors score differently than drivers (two drivers + team performance) — their PPM distribution is fundamentally different and needs separate calibration.

### 3. Binary outcomes dominate

71% of price changes fell in either "Great" or "Terrible." The middle categories (Good/Poor) rarely trigger. This makes the system effectively binary — maximum gain or maximum loss — with little nuance in between.

**Implication:** The threshold spacing (0.6/0.9/1.2) may be too narrow for the actual PPM distribution of our scoring model. Wider or asymmetrically-spaced thresholds could create more gradation.

### 4. Streak behaviour

Once an entity starts gaining, it tends to continue for several consecutive rounds before reversing. Predictable wave patterns that informed players can exploit. This is partly a consequence of equally-weighted windows and binary outcomes.

---

## The Equal-Weight Window Debate

F1 Fantasy Tools criticises the equally-weighted 3-race window, arguing that only 33% of the price signal comes from the most recent race and 66% from older data. They suggest recency weighting (e.g., 4/7, 2/7, 1/7) where the most recent race counts most.

### The counterargument: anomaly tolerance

With equal weighting, an anomalous result (car failure, safety car, one-off mechanical) enters the window at 33% weight and exits at 33% weight. The effect is symmetric and bounded.

With recency weighting (e.g., 50/30/20), an anomaly enters at 50% weight and exits at only 20% — asymmetric. It hits harder on entry than it recovers on exit. A car failure punishes a driver's price more than their next two good races can repair.

| | Equal weight (33/33/33) | Recency weight (50/30/20) |
|---|---|---|
| Anomaly impact on entry | 33% | 50% |
| Anomaly impact at exit | 33% | 20% |
| Trajectory sensitivity | Low | High |
| Anomaly tolerance | High | Low |

**The real tradeoff:** Recency weighting is better at capturing momentum (improving vs declining form). Equal weighting is better at protecting players from one anomalous race having outsized impact on prices. For a game where mechanical failures, safety cars, and strategic anomalies are common, anomaly tolerance may be more important than trajectory sensitivity.

**This is a design values question, not a simulation question.** Decide which property matters more, then validate in simulation.

---

## Preseason Pricing Under a Direction-Based Model

Dropping the power curve for in-season does not eliminate the need for preseason pricing — something must seed the initial prices. However, the stakes are lower because the PPM feedback loop self-corrects: a mispriced entity will have an abnormal PPM, causing rapid correction in the first few races.

### The linearity consistency issue

The power curve is non-linear — it implies different "correct" PPM values at different price levels. A PPM system with a uniform neutral point is linear — it assumes the same points-per-dollar is correct for all entities at all price levels.

Using a power curve for preseason + PPM for in-season creates a structural mismatch: entities priced via the power curve will have varying natural PPMs, which means the in-season mechanism will systematically push some toward neutral and away from their power-curve-implied "correct" price.

### Options

1. **Keep power curve for preseason only** — accept the mismatch; the PPM loop will correct it within a few races. Benefit: retains mid-field differentiation (14/21 drivers vs 9/21 for multiplier). Cost: inconsistency between preseason and in-season logic.

2. **Switch to multiplier** — consistent with a uniform PPM neutral point. Cost: worse mid-field differentiation.

3. **Tiered price bands** — manually or formula-driven price brackets (e.g., top-4 scorers get $17-19M, next-4 get $13-16M). Flexible, but requires calibration and introduces human judgment.

4. **Seed-and-correct** — use any reasonable preseason formula and rely on the PPM loop to correct aggressively in the first 2-3 races. This is F1 Fantasy's implicit approach (editorial preseason prices, algorithm takes over immediately).

---

## Open Questions for Simulation

These are the unknowns that need to be resolved through simulation against 2025 data:

### 1. What neutral point works for our scoring model?

F1's 0.9 PPM is miscalibrated for their own B-Tier drivers. Our scoring model has different point distributions. Need to find the PPM at which an entity is on average "correctly priced" — i.e., where the system produces stable prices over a full season without systematic inflation or deflation.

Likely needs separate calibration for:
- Drivers vs constructors (fundamentally different scoring structures)
- Possibly A-Tier vs B-Tier (different average PPM at different price levels)

### 2. What step sizes produce acceptable correction speed?

The tradeoffs:
- Too small: prices never reflect real performance changes; stale prices persist
- Too large: prices are noisy, weekly swings feel arbitrary, anomalies are punished harshly

Evaluate against: speed of correction after a genuine performance shift (e.g., driver finds form mid-season), and stability during noise (e.g., one anomalous bad race).

### 3. Does a single tier boundary work, or do we need a different split?

F1 uses $19M as the A/B-Tier boundary. Our price range and distribution are different (driver ceiling $19M, constructor ceiling $25M). The tier boundary determines where the step size changes — it needs to be placed where the natural PPM distribution changes meaningfully.

### 4. Equal vs recency-weighted window

Choose: anomaly tolerance (equal) vs trajectory sensitivity (recency). Then simulate both to quantify the actual difference in correction speed and price stability.

### 5. What happens to preseason mispricing under PPM correction?

With the power curve + ±10% cap, we know early-season mispricing and correction speed from prior simulation. Simulate the PPM model against the same early-season data: how quickly does it correct known preseason errors (ANT, SAI, TSU)? Is it faster or slower than the current model?

---

## Decision Sequence

Resolution order matters — later decisions depend on earlier ones:

1. **Confirm the philosophical direction** — direction-based vs target-based. This is a design values decision, not a simulation one.
2. **Find the neutral point** — separate for drivers/constructors; validate no systematic inflation/deflation
3. **Calibrate step sizes** — against correction speed and volatility criteria
4. **Decide window weighting** — anomaly tolerance vs trajectory sensitivity
5. **Decide preseason formula** — after understanding how quickly the PPM loop self-corrects from seed errors

---

## Status

**Simulated.** See [pricing-model-direction-based-simulation.md](./pricing-model-direction-based-simulation.md) for full results.

**Summary of findings:**
- Core parameters settled: D neutral=1.00, C neutral=1.50; band width ±0.60; equal window weight; inner/outer ratio 3:1.
- Band width sweep resolved binary outcome problem: ±0.60 reduced extreme-band concentration from 73% to 50%. Middle bands now functional.
- The self-limiting feedback loop works as theorised — no hard ceiling required.
- Two structural issues remain: floor compression (5D+1C at $6M, not affected by band width) and mid-field oscillation (partially improved).
- One design choice open: per-type uniform steps (D=$0.50M, C=$0.60M; simpler, $2.1M combined drift) vs tiered (near-zero drift, higher swing, more parameters).

**Next action:** Choose per-type vs tiered, then address floor compression.
