# Direction-Based Pricing Model — Simulation Results

**Status:** Complete
**Date:** 2026-03-09
**Parent:** [pricing-model-direction-based.md](./pricing-model-direction-based.md)
**Script:** `simulation/ppm_simulation.py`
**Data:** 2025 season (24 rounds)

---

## Summary

The simulation validated the PPM feedback loop as a real and functional mechanism. The self-limiting behaviour works as theorised — dominant entities self-correct without a hard ceiling. The initial ±0.30 band width (from F1) produced a 72% binary-outcome problem; widening to ±0.60 reduced extreme-band classifications from 73% to 50%, making middle bands functional. Most parameters are now settled. Two structural issues remain: floor compression (5D+1C permanently at $6M) and mid-field oscillation (partially improved but not resolved). One design choice remains open: per-type uniform steps vs price-based tiered steps.

---

## Q1: Neutral Point

**Finding: Separate calibration is mandatory. Drivers need 1.00 PPM, constructors need 1.50 PPM.**

**Note: This sweep was run at ±0.30 band width. The band distributions shown below reflect that width and are no longer current. The neutral points themselves were re-confirmed at ±0.60 in the Q1 recalibration (see Q2/Q3 re-run section below) and held stable. The D=1.00 and C=1.50 values are robust across three independent calibrations.**

**Cross-season validation complete** (see `simulation/output/ppm/neutral_point_validation_report.md`):

| Season | Competitive landscape | D=1.00 drift | Best D | C=1.50 drift | Best C |
|--------|-----------------------|-------------|--------|-------------|--------|
| 2023 | VER-dominant, major order shake-up (AM/McLaren rise) | +$20.7M | 1.30 | +$8.7M | 1.80 |
| 2024 | VER-dominant, McLaren/Ferrari surge | +$5.0M | 1.10 | +$0.5M | 1.50 |
| 2025 | Competitive field | −$3.8M | 1.00 | −$3.5M | 1.50 |

**C=1.50 is stable** across all three seasons. **D=1.00 shows increasing upward drift as the competitive order diverges from prior-year prices.** The 2023 inflation (+$20.7M) reflects the model correctly repricing badly mispriced entities — ALO at $7.6M producing PPM 1.96, Aston Martin at $6M producing PPM 3.26 after an unpredictable car improvement. That is the model working, not a neutral point miscalibration. Net drift is not inherently bad when it is directionally correct. D=1.00 and C=1.50 remain the appropriate defaults; the optimal driver neutral shifts only when preseason prices are systematically wrong due to a dramatic competitive order change, which is unavoidable with prior-year-based pricing.

### Actual PPM distribution at preseason prices

**Drivers** (mean: 0.761, median: 0.725):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| PIA | 1.650 | $15.2M |
| RUS | 1.612 | $13.7M |
| NOR | 1.527 | $17.0M |
| VER | 1.463 | $18.4M |
| LEC | 1.010 | $16.3M |
| ALB | 0.990 | $6.1M |
| HAM | 0.911 | $14.0M |
| ANT | 0.827 | $13.1M |
| BEA | 0.758 | $7.2M |
| OCO | 0.736 | $7.3M |
| HAD | 0.725 | $6.9M |
| HUL | 0.698 | $7.1M |
| STR | 0.652 | $6.9M |
| TSU | 0.592 | $10.7M |
| SAI | 0.487 | $10.0M |
| LAW | 0.447 | $6.9M |
| ALO | 0.351 | $8.9M |
| GAS | 0.346 | $7.7M |
| BOR | 0.208 | $6.6M |
| COL | 0.160 | $7.3M |
| DOO | −0.160 | $7.3M |

**Constructors** (mean: 1.128, median: 1.201):

| Entity | Avg PPM | Preseason price |
|--------|---------|----------------|
| McLaren | 1.975 | $25.0M |
| Mercedes | 1.654 | $19.4M |
| Red Bull Racing | 1.498 | $21.5M |
| Williams | 1.472 | $6.0M |
| Ferrari | 1.201 | $23.1M |
| Haas F1 Team | 1.180 | $8.3M |
| Racing Bulls | 0.927 | $7.6M |
| Aston Martin | 0.593 | $9.0M |
| Kick Sauber | 0.590 | $7.2M |
| Alpine | 0.186 | $8.5M |

The 50% difference between driver (1.00) and constructor (1.50) neutrals is structural, not coincidental. Constructors score two drivers' worth of points against a single price — a correctly-priced constructor naturally produces higher PPM than a correctly-priced driver at the same efficiency.

### Neutral point sweep

**Drivers** — net drift across the field at each neutral:

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 0.70 | +$23.9M | 12 | 9 | G:166 g:77 p:61 T:158 |
| 0.80 | +$15.3M | 11 | 10 | G:150 g:74 p:61 T:177 |
| 0.90 | +$6.6M | 11 | 10 | G:131 g:72 p:66 T:193 |
| **1.00** | **−$0.5M** | **9** | **12** | G:117 g:62 p:75 T:208 |
| 1.10 | −$8.5M | 6 | 14 | G:100 g:62 p:70 T:230 |
| 1.20 | −$14.6M | 5 | 15 | G:88 g:55 p:69 T:250 |

**Constructors** — net drift across the field at each neutral:

| Neutral | Net change | Inflated | Deflated | Band dist |
|---------|-----------|----------|----------|-----------|
| 1.00 | +$12.9M | 7 | 3 | G:93 g:28 p:29 T:70 |
| 1.20 | +$6.9M | 7 | 3 | G:79 g:31 p:21 T:89 |
| **1.50** | **−$2.8M** | **5** | **5** | G:62 g:21 p:31 T:106 |
| 1.80 | −$10.8M | 2 | 8 | G:49 g:18 p:25 T:128 |

At driver neutral=1.00: 9 inflate, 12 deflate, net −$0.5M — near-zero, slightly deflation-biased by count.
At constructor neutral=1.50: 5 inflate, 5 deflate, net −$2.8M — perfectly symmetric by count.

F1's single 0.90 threshold is too low for both types in our scoring model. A unified neutral point would guarantee systematic drift in one direction for at least one entity type.

**Band distribution problem (at ±0.30):** At driver neutral=1.00, the Great+Terrible bands account for 72% of all classifications (117+208 = 325 out of 462). The middle two bands barely exist. This is the same binary outcome problem identified in F1's implementation — and shifting the neutral point doesn't fix it. The band *width* (±0.30 from neutral) is too narrow for the actual PPM spread. See Band Width Sweep below for the resolution.

---

## Q2: Step Sizes

**Finding: Scale 1.0× (F1's base steps: ±$0.3M A-tier, ±$0.6M B-tier) is the sweet spot. Neutral point and step size are coupled — cannot be tuned independently.**

| Scale | Max 3R swing | Avg Δ/round | D max price | C max price | D net | C net |
|-------|-------------|-------------|-------------|-------------|-------|-------|
| 0.25 | 6.7% | $3.0M | $19.5M | $26.1M | −$11.1M | −$6.3M |
| 0.50 | 10.0% | $4.7M | $20.6M | $27.2M | −$8.0M | −$6.3M |
| 0.75 | 13.3% | $6.1M | $20.6M | $27.4M | −$6.4M | −$5.2M |
| **1.00** | **20.0%** | **$7.9M** | **$21.7M** | **$28.4M** | **−$0.5M** | **−$2.8M** |
| 1.50 | 30.0% | $11.1M | $22.6M | $29.8M | +$5.5M | +$0.3M |
| 2.00 | 40.0% | $14.2M | $24.2M | $31.8M | +$15.0M | +$2.8M |

Net drift flips from deflation to inflation between scale 1.0 and 1.5. The neutral points were calibrated at scale 1.0 — at scale 1.5, the same neutral points produce net inflation.

**Why the coupling exists:** At larger step sizes, "terrible" ratings push entities toward the $6M floor harder. Once at the floor they can only go up. The floor acts as a one-way ratchet — down-pressure is absorbed, but there is no corresponding absorption at the top (no ceiling clamp). This creates systematic net inflation at higher scales. If a different step scale is chosen, the neutral point sweep must be re-run at that scale.

**Max prices are reasonable at scale 1.0:** driver max $21.7M (VER, +$3.3M), constructor max $28.4M (McLaren, +$3.4M). The self-correction loop keeps these bounded without a hard ceiling.

---

## Q3: Tier Boundary

**Finding (at ±0.30): The tier boundary has no meaningful effect. Drop it.**

Every boundary configuration (D: $10M–$15M, C: $16M–$21M) produced identical max prices and max swing. Net drift varied by only $1.4M across all 15 combinations.

In our model, rising price naturally suppresses PPM — the feedback loop self-limits expensive entities without any step-size distinction by tier. The boundary adds complexity without changing outcomes.

**Note: This conclusion was reached at ±0.30 band width and was superseded when band width widened to ±0.60.** At ±0.60, the tiered approach achieves near-zero total drift ($0.2M) and becomes competitive with per-type. The per-type vs tiered question was re-opened — see Q3 re-run below.

---

## Q4: Window Weighting

**Finding: Irrelevant in practice. Use equal weighting.**

| Config | Avg Δ/round | D net | C net |
|--------|-------------|-------|-------|
| Equal (1:1:1) | $10.8M | +$5.2M | +$0.3M |
| Light recency (1:1:2) | $10.9M | +$7.7M | +$0.3M |
| Moderate recency (1:2:3) | $10.9M | +$8.2M | −$0.7M |
| Heavy recency (1:2:4) | $10.9M | +$4.1M | −$0.5M |

All within $0.1M average round change. Band distributions differ by at most ±6 counts across 24 rounds of 21 drivers. Fixed-dollar steps on coarse bands mean per-round weighting differences cancel out over a season.

Equal weighting wins on simplicity and anomaly tolerance with zero practical cost.

---

## Q5: Preseason Mispricing Correction

**Finding: Clear mispricing corrects within R5. Moderate mispricing takes until R10. Correction is directionally accurate.**

| Entity | Direction | Preseason | Final | Change | First 5% |
|--------|-----------|-----------|-------|--------|----------|
| SAI | Overpriced | $10.0M | $8.1M | −19.0% | R5 |
| TSU | Overpriced | $10.7M | $8.1M | −24.3% | R5 |
| ANT | Overpriced | $13.1M | $12.0M | −8.4% | R10 |

**SAI trajectory:** $10.0M → $10.0M → $7.8M → $6.0M (R12 trough) → $8.1M (R24 recovery). PPM of 0.487 at preseason — deep "terrible." Crashes fast, then recovers as late-season form improved. The model captures the form arc.

**TSU trajectory:** $10.7M → $10.7M → $8.9M → $6.3M (R18 trough) → $8.1M (R24 recovery). Similar pattern to SAI.

**ANT trajectory:** $13.1M → $13.1M → $13.2M → $12.6M → $11.4M → $8.6M → $12.0M. The team-context pricing put ANT at $13.1M (Mercedes per-driver avg). Actual 2025 PPM was 0.827 — below the 1.00 driver neutral. The model correctly identifies this as overpriced and adjusts. The correction is slower because ANT's PPM sits in "poor" (−$0.15M/round), not "terrible" — moderate mispricing receives a moderate correction rate.

The correction is transparent: there is no hidden target the price is lagging toward. The adjustments are the full story.

---

## Full Season Price Evolution (Best Configuration)

**Configuration:** D neutral=1.00, C neutral=1.50, scale=1.0×, single tier, equal weight (3-race window)

### Drivers

| Driver | Preseason | R3 | R6 | R9 | R12 | R18 | R24 | Season | Δ |
|--------|-----------|----|----|----|----|-----|-----|--------|---|
| VER | $18.4M | $18.4M | $19.6M | $20.4M | $20.0M | $20.2M | $22.6M | 646 | +$4.2M |
| NOR | $17.0M | $17.0M | $18.2M | $19.4M | $19.8M | $20.8M | $22.0M | 623 | +$5.0M |
| LEC | $16.3M | $16.3M | $16.0M | $16.2M | $17.4M | $16.8M | $17.4M | 395 | +$1.1M |
| PIA | $15.2M | $15.2M | $16.4M | $17.6M | $18.8M | $20.6M | $18.6M | 602 | +$3.4M |
| HAM | $14.0M | $14.0M | $13.2M | $14.0M | $14.8M | $14.0M | $13.2M | 306 | −$0.8M |
| RUS | $13.7M | $13.7M | $15.0M | $16.0M | $16.4M | $17.2M | $19.2M | 530 | +$5.5M |
| ANT | $13.1M | $13.1M | $13.2M | $12.6M | $11.4M | $8.6M | $12.0M | 260 | −$1.1M |
| TSU | $10.7M | $10.7M | $8.9M | $8.6M | $6.5M | $6.3M | $8.1M | 152 | −$2.6M |
| SAI | $10.0M | $10.0M | $7.8M | $6.3M | $6.0M | $6.9M | $8.1M | 117 | −$1.9M |
| ALO | $8.9M | $8.9M | $6.2M | $6.0M | $6.9M | $6.9M | $6.3M | 75 | −$2.6M |
| GAS | $7.7M | $7.7M | $6.0M | $6.0M | $6.0M | $6.0M | $6.0M | 64 | −$1.7M |
| OCO | $7.3M | $7.3M | $8.2M | $6.1M | $6.0M | $6.3M | $8.1M | 129 | +$0.8M |
| DOO | $7.3M | $7.3M | $6.0M | $6.0M | $6.0M | $6.0M | $6.0M | −7 | −$1.3M |
| COL | $7.3M | $7.3M | $6.0M | $6.0M | $6.0M | $6.0M | $6.0M | 21 | −$1.3M |
| BEA | $7.2M | $7.2M | $8.1M | $6.0M | $6.0M | $6.9M | $7.8M | 131 | +$0.6M |
| HUL | $7.1M | $7.1M | $6.0M | $6.0M | $8.7M | $9.8M | $6.0M | 119 | −$1.1M |
| STR | $6.9M | $6.9M | $6.0M | $7.5M | $6.0M | $9.6M | $6.0M | 108 | −$0.9M |
| LAW | $6.9M | $6.9M | $6.0M | $6.0M | $6.0M | $6.9M | $6.3M | 74 | −$0.6M |
| HAD | $6.9M | $6.9M | $6.0M | $6.3M | $7.8M | $8.7M | $7.5M | 120 | +$0.6M |
| BOR | $6.6M | $6.6M | $6.0M | $6.0M | $6.0M | $6.0M | $6.0M | 33 | −$0.6M |
| ALB | $6.1M | $6.1M | $6.4M | $9.1M | $6.4M | $9.6M | $6.6M | 145 | +$0.5M |

### Constructors

| Constructor | Preseason | R3 | R6 | R9 | R12 | R18 | R24 | Season | Δ |
|-------------|-----------|----|----|----|----|-----|-----|--------|---|
| McLaren | $25.0M | $25.0M | $26.2M | $27.4M | $28.2M | $29.4M | $27.6M | 1185 | +$2.6M |
| Ferrari | $23.1M | $23.1M | $22.4M | $22.2M | $23.0M | $22.0M | $21.2M | 666 | −$1.9M |
| Red Bull Racing | $21.5M | $21.5M | $21.2M | $21.4M | $20.4M | $19.7M | $22.2M | 773 | +$0.7M |
| Mercedes | $19.4M | $19.4M | $20.4M | $20.2M | $19.4M | $17.4M | $20.8M | 770 | +$1.4M |
| Aston Martin | $9.0M | $9.0M | $6.3M | $6.0M | $6.0M | $9.6M | $6.0M | 128 | −$3.0M |
| Alpine | $8.5M | $8.5M | $6.0M | $6.0M | $6.0M | $6.0M | $6.0M | 38 | −$2.5M |
| Haas F1 Team | $8.3M | $8.3M | $9.8M | $7.1M | $6.0M | $6.9M | $9.0M | 235 | +$0.7M |
| Racing Bulls | $7.6M | $7.6M | $6.0M | $6.0M | $6.0M | $8.7M | $8.1M | 169 | +$0.5M |
| Kick Sauber | $7.2M | $7.2M | $6.0M | $6.0M | $8.1M | $7.5M | $6.0M | 102 | −$1.2M |
| Williams | $6.0M | $6.0M | $6.0M | $7.8M | $6.0M | $9.6M | $9.0M | 212 | +$3.0M |

---

## Observed Behaviours

### Self-correction in action

The feedback loop works as theorised. McLaren rises from $25.0M to a peak of $29.4M at R18, then falls back to $27.6M at R24 — no ceiling required. The rising price suppressed PPM, shifting McLaren from "great" to "good" to eventually "poor" territory. PIA and RUS show the same arc: price rises until PPM falls below neutral, then reverses.

RUS (+$5.5M, largest driver gain) is correctly repriced — at $13.7M preseason and 22.1 pts/race, PPM was 1.61, persistently above the 1.00 neutral even as price rose. The model identified and corrected a genuine undervaluation.

### Floor compression

GAS, COL, DOO, BOR all hit $6.0M and stayed there for most of the season. Despite scoring 64, 21, −7, and 33 points respectively, they cannot be distinguished by price. The floor creates the same zero-signal problem the ceiling created for McLaren in the target-based model — just at the other end.

### Mid-field oscillation

STR: $6.9M → $6.0M → $7.5M → $6.0M → $9.6M → $6.0M
HUL: $7.1M → $6.0M → $8.7M → $9.8M → $6.0M
ALB: $6.1M → $6.4M → $9.1M → $6.4M → $9.6M → $6.6M

Cheap entities oscillate between the floor and ~$9–10M on a repeating cycle. When cheap, any decent race produces high PPM ("great" → +$0.9M). As price rises, the same performance yields lower PPM, eventually triggering "terrible" (−$0.9M), and the price crashes back. A $0.9M step on a $6M entity is a 15% move — disproportionately large. This creates the "streak behaviour" the research brief flagged in F1's implementation.

---

## Structural Assessment

### What works

1. **Self-limiting feedback loop is functional.** Dominant entities self-correct without a hard ceiling.
2. **Separate neutral points eliminate systematic drift.** D=1.00, C=1.50 are empirically grounded.
3. **Clear mispricing corrects quickly.** SAI and TSU reach 5% correction by R5.
4. **No hidden target.** The displayed price is the full story — no lagging correction backlog.
5. **Window weighting is irrelevant.** Equal weight simplifies the model with no cost.
6. **Tier boundary is irrelevant.** Drop it — the feedback loop handles what it was designed to prevent.

### What doesn't work

1. **Binary band distribution.** 72% of classifications fall in "great" or "terrible." The middle bands (good/poor) account for only 28% of outcomes. The system is effectively binary: maximum step up or maximum step down most rounds.

2. **Floor compression.** 5+ drivers permanently at $6M with no price differentiation. Same zero-signal problem as ceiling pinning, at the other end.

3. **Mid-field oscillation.** Cheap entities cycle between floor and ~$9–10M repeatedly. Predictable and exploitable by informed players.

4. **Neutral-step coupling.** The optimal neutral point shifts with step size due to floor ratchet asymmetry. They cannot be tuned independently — if step size changes, the neutral point sweep must be re-run.

### Root cause

All four problems share the same origin: **the band thresholds (neutral ± 0.30) are too narrow for the actual PPM spread.** Drivers range from −0.16 to 1.65 PPM, but the four bands span only 0.60 PPM (0.70 to 1.30 at neutral=1.00). Everything outside that corridor falls in the extreme bands. Widening the band spacing is the most direct fix for problems 1, 2, and 3 simultaneously — wider bands would reduce binary outcomes, let the floor tier generate meaningful price signals, and dampen mid-field oscillation.

---

## Band Width Sweep

The ±0.30 band width (inherited from F1's implementation) produced 72% extreme-band classifications — the system was effectively binary. Wider widths were tested to find a more balanced distribution.

**Method:** Sweep band half-widths from ±0.30 to ±1.00, using per-type baseline steps (D=$0.40M, C=$0.60M) and Q1-best neutral points (D=1.00, C=1.50). Imbalance = sum of squared deviations from 25% per band.

| Width | Great | Good | Poor | Terrible | Imbalance | D net | C net | Floor pinned |
|-------|-------|------|------|----------|-----------|-------|-------|-------------|
| ±0.30 | 26% | 13% | 14% | 47% | 0.0748 | +$0.2M | −$1.2M | 5D+1C |
| ±0.40 | 22% | 17% | 19% | 42% | 0.0416 | −$1.0M | −$2.4M | 5D+1C |
| ±0.50 | 20% | 19% | 22% | 39% | 0.0272 | −$2.2M | −$2.0M | 5D+1C |
| **±0.60** | **16%** | **23%** | **27%** | **34%** | **0.0182** | **−$3.5M** | **−$1.5M** | **5D+1C** |
| ±0.70 | 13% | 25% | 32% | 30% | 0.0217 | −$3.2M | −$2.7M | 5D+1C |
| ±0.80 | 11% | 27% | 38% | 24% | 0.0363 | −$4.8M | −$2.7M | 4D+1C |
| ±1.00 | 6% | 32% | 47% | 15% | 0.0964 | −$7.2M | −$3.8M | 4D+1C |

**Selected: ±0.60** — lowest imbalance. For drivers at neutral=1.00, thresholds become (0.40, 1.00, 1.60). For constructors at neutral=1.50, thresholds become (0.90, 1.50, 2.10).

### What changed

Middle bands now account for 50% of classifications (23% good + 27% poor) vs 27% at ±0.30. The system is no longer effectively binary — inner steps ($0.10M/$0.20M) now meaningfully contribute to price movement.

### What didn't change

The distribution is still asymmetric: terrible (34%) > great (16%). This reflects the structural reality that more entities sit below-neutral than above-neutral. The PPM distribution is not symmetric around the neutral point, so a perfectly balanced 25/25/25/25 split isn't achievable with a single band width.

Floor compression (5D+1C pinned at $6M for ≥50% of rounds) is unchanged across all widths tested. This is a separate problem — entities with fundamentally low PPM stay at floor regardless of band width. The floor absorbs their downward pressure, but their PPM at floor price is still too low to trigger upward movement.

---

## Q2/Q3 Re-run at ±0.60 Band Width

With band width fixed at ±0.60, step magnitudes and tier structures were re-calibrated.

### Q2: Step magnitudes

| Outer | Inner | Swing | D net | C net |
|-------|-------|-------|-------|-------|
| $0.10M | $0.10M | 3.3% | −$7.2M | −$4.5M |
| $0.20M | $0.10M | 6.7% | −$7.2M | −$5.8M |
| $0.30M | $0.10M | 10.0% | −$5.5M | −$5.5M |
| $0.40M | $0.10M | 13.3% | −$3.5M | −$4.7M |
| **$0.50M** | **$0.20M** | **16.7%** | **+$0.6M** | **−$3.1M** |
| $0.60M | $0.20M | 20.0% | +$2.8M | −$1.5M |
| $0.90M | $0.30M | 30.0% | +$9.2M | +$2.9M |

**Best uniform: $0.50M outer** (was $0.40M at ±0.30). Wider bands push more classifications into the middle, so the outer (extreme) steps need to be larger to maintain adequate correction speed. Driver drift near-zero (+$0.6M), constructor drift −$3.1M.

### Q3: Per-type vs tiered

Three approaches re-tested at ±0.60 band width:

| Approach | Config | D net | C net | Total Drift | Swing |
|----------|--------|-------|-------|-----------|-------|
| Uniform | $0.50M all | +$0.6M | −$3.1M | $3.7M | 16.7% |
| **Per-type** | **D=$0.50M C=$0.60M** | **+$0.6M** | **−$1.5M** | **$2.1M** | **20.0%** |
| Tiered | A=75% B=150% D≥$15M C≥$21M | +$0.2M | $0.0M | $0.2M | 26.7% |

The same structural pattern holds: tiered configs win on drift (near-zero) but require higher swing. Per-type is the simpler option with acceptable drift.

### Q1 recalibration

Neutral points re-swept at the Q3-winning tiered config + ±0.60 band width:
- **Driver optimal: 1.00** (net=+$0.2M) — unchanged
- **Constructor optimal: 1.50** (net=$0.0M) — unchanged

Neutral points have now held stable through three independent calibrations (original Q1, Q2/Q3 redesign recal, band width recal). These are robust.

---

## Consolidated Parameters

All five open questions from the research brief have been tested. Parameters that are settled vs still in contention:

### Settled

| Parameter | Value | Confidence |
|-----------|-------|------------|
| Driver neutral point | 1.00 PPM | High — stable across 3 recalibrations |
| Constructor neutral point | 1.50 PPM | High — stable across 3 recalibrations |
| Band width | ±0.60 from neutral | High — lowest imbalance in sweep |
| Window weighting | Equal (1:1:1) | High — no practical difference, simplest |
| Inner/outer step ratio | 3:1 (inner = outer/3) | Moderate — inherited from F1, not independently tested |

### Design choice: per-type vs tiered

| | Per-type uniform | Tiered (A=75% B=150%) |
|---|---|---|
| Parameters | 2 (D outer, C outer) | 4 (A frac, B mult, D boundary, C boundary) |
| Driver steps | $0.50M / $0.20M | A: $0.40M/$0.10M, B: $0.80M/$0.30M |
| Constructor steps | $0.60M / $0.20M | same as driver |
| D net drift | +$0.6M | +$0.2M |
| C net drift | −$1.5M | $0.0M |
| Max 3-race swing | 20.0% | 26.7% |
| Complexity | Low | Moderate |

Per-type is simpler with $2.1M total drift. Tiered achieves near-zero drift but adds 4 parameters and 6.7% more swing.

**Note on swing % as a comparator:** Raw swing % may not be a fair basis for comparing approaches. Since oscillation is PPM-driven, swings are tied to actual performance — an entity performing well genuinely deserves a meaningful price rise. Performance-driven swings are appropriate and reflect real F1 volatility. The concern is specifically with mechanically-induced oscillation (price rising until PPM crosses a threshold, triggering reversal, regardless of whether actual performance changed). Swing % alone does not distinguish between these two cases and should not be used as a standalone metric for evaluating the per-type vs tiered tradeoff.

### Unresolved

1. **Floor compression** — 5 drivers and 1 constructor pinned at $6M for most of the season. Not addressed by band width, step size, or tier structure. Possible fixes: lower the floor, add a sub-floor differentiation mechanism, or accept it as inherent to any floor-bounded system.

2. **Mid-field oscillation** — partially improved by wider bands (fewer extreme-band classifications = smaller average step = less violent swings), but cheap entities still cycle. The 3:1 outer/inner ratio means a "great" classification on a $6M entity moves price by 8.3% ($0.50M/$6M) — still large. The rolling 3-race window means one good race persists for 3 rounds of influence.

3. **Per-type vs tiered** — a design values decision, not a simulation one. The data shows the tradeoff clearly; the choice depends on whether near-zero drift or lower complexity is prioritised.

4. **Unified neutral point never simulated** — separate neutrals (D=1.00, C=1.50) were justified analytically: constructors aggregate two drivers' points against a single price, producing structurally higher PPM. This argument is supported by F1 Fantasy's known flaw (systematic constructor price inflation under their single 0.9 neutral). However, no simulation comparison was run. Treated as a validated assumption, not an empirically tested finding.

5. **Neutral point recalibration on scoring changes** — the neutral points are calibrated against a specific scoring model output. Any systematic change to scoring (e.g. captain DNF impact, overtake points, penalty adjustments) would shift the PPM distribution and require re-running Q1 to confirm D=1.00 and C=1.50 still produce near-zero drift.
