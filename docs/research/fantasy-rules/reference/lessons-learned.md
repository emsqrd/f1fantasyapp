# Lessons Learned — Pricing Exploration

Consolidated insights from the first attempt at building a pricing model. These are not conclusions about what to do — those belong in `decisions/`. These are the hard-won lessons about what the problems actually are and why certain intuitive approaches fail.

---

## 1. Target-based pricing cannot satisfy "current price reflects current value"

The first model computed a per-race average, fed it into a power curve, got a **target price**, and moved the current price ±10% toward that target each round.

The flaw is philosophical: **the target is not a known truth.** It is a formula output anchored to a prior season's performance baseline (REF_MAX). The model invents what an entity "should" cost and then treats the gap between current price and that invention as an error to correct.

This means the displayed price is always in transit toward somewhere else. Players making a weekly decision are using a price the model itself considers wrong. Mispricing is not corrected — it is replaced by a different form of lag.

The target-based approach cannot satisfy the criterion that in-season price should reflect current value. It satisfies a weaker claim: prices will eventually approximate correct values if the season is long enough.

**The fix:** Direction-based pricing. Don't compute a target. Ask only whether the entity is delivering value relative to its current cost (PPM). If above neutral, price rises. If below, it falls. The displayed price is the full story.

---

## 2. ±10% percentage-based movement compounds badly

A ±10% per-round price cap sounds conservative. In practice:

- At $25M, ±10% = ±$2.5M per round — large in absolute terms
- Three consecutive bad rounds: 1 − (0.90)³ ≈ 27% drop
- Mercedes dropped $10.7M over 10 rounds in 2025 simulation — catastrophic for any player who bought at the R4 peak
- The compounding is asymmetric: a $10M drop is harder to recover from than a $10M gain provides flexibility, because budget constraints don't compress symmetrically

The "dynamic pricing self-corrects" argument fails from the player's perspective. A price that is wrong at R8 actively misleads a player making an R8 decision, regardless of whether it is right by R16. The path to correction is the problem.

**The fix:** Fixed-dollar steps, not percentage. A $0.50M move on a $20M entity and a $0.50M move on a $7M entity are the same dollar amount. No compounding. Maximum season drift is bounded by arithmetic: step × rounds.

---

## 3. Ceiling pinning and floor compression are the same problem at opposite ends

Ceiling pinning: McLaren was pinned at the $25M ceiling for **16 of 24 rounds** in the target-based model. For two-thirds of the season, the most important entity in the game showed zero price movement — no signal.

Floor compression: In the direction-based model, 5 drivers (GAS, COL, DOO, BOR, and others) were pinned at the $6M floor for most of the season despite different actual scores (64, 21, −7, 33 pts).

Both are the same failure mode: the price mechanism hits a boundary and stops. Everything beyond the boundary is invisible to the player. The entity is still performing (or failing to perform), but the price has nothing left to say about it.

**Ceiling pinning in the target model** has a specific additional cause: the model normalises against REF_MAX anchored to a prior season. If the current season's dominant entity exceeds that baseline, its target price is capped even if the formula could go higher — and the ±10% movement ensures it reaches the ceiling fast and stays there.

**Floor compression in the direction model** is inherent to any floor-bounded system where some entities have fundamentally low PPM. The floor absorbs down-pressure but their PPM at floor price is still too low to trigger upward movement. They are stranded.

Neither problem is solved by adjusting step sizes or neutral points. They require structural choices: whether a hard floor/ceiling exists at all, how it is defined, and whether there is a mechanism to differentiate entities that are both price-bounded.

---

## 4. Why ±10% caps compound: the ratchet asymmetry

The floor is a one-way ratchet. Down-pressure is absorbed at the floor. But there is no corresponding absorption at the top.

This matters for neutral point calibration. At higher step scales, "terrible" ratings push entities toward the $6M floor. Once there, they can only go up. Even one modestly good race produces high PPM on a cheap entity (high points ÷ low price). The entity rises, then falls back when its price reduces its PPM again. The result: mechanically-driven oscillation between floor and mid-tier, not performance-driven pricing.

This also means **neutral point and step size cannot be tuned independently.** If the step scale changes, the neutral point must be re-swept. The two parameters interact through the floor ratchet.

---

## 5. The "optimising the wrong thing" insight

Early research optimised for **near-zero net drift** — the total price change across all entities over a full season should sum close to zero.

This is the wrong objective.

Drift is not inherently bad. In 2023, Aston Martin arrived at a tiny $6M preseason price and then had a dramatic car improvement — real PPM far above neutral. The model correctly repriced AM upward. That is the model working as intended, not a calibration failure. A model that suppressed this correction in the name of "zero drift" would be hiding real performance information.

**The right objective:** Prices move in the correct direction relative to actual performance. Drift should be near-zero for a *typical* competitive season (where the prior year's prices are roughly correct) but tolerate drift when genuine performance diverges from priors.

The neutral point calibration should minimise systematic drift (prices consistently inflating or deflating even when entities are performing as expected) — not total season drift, which includes legitimate repricing.

---

## 6. The neutral point must be calibrated per season, not set once as a constant

According to f1fantasytools.com's reverse-engineering of F1 Fantasy's in-season pricing mechanism, the official game uses a single 0.9 PPM neutral for all entities. Their analysis found that cheaper drivers sit well below the 0.6 "terrible" threshold on average — losing money nearly every round regardless of relative performance within their tier. F1 Fantasy's actual mechanism is unpublished; f1fantasytools.com is not affiliated with F1 and their findings represent one season of observed outputs, not confirmed design intent.

The structural problem their finding illustrates is sound regardless of the specifics: if the neutral point is set above the actual average PPM of a price tier, every entity in that tier deflates systematically — not because they're underperforming, but because the neutral is miscalibrated for their price level.

**Two separate problems are conflated in F1's implementation:**

First, a single neutral cannot work for both entity types. **Constructors score two drivers' worth of points against a single price** — a correctly-priced constructor naturally produces higher PPM than a correctly-priced driver at the same value-efficiency. Separate neutrals for drivers and constructors are structurally necessary, not a tuning preference.

Second, and more importantly: **the neutral point cannot be treated as a universal constant across seasons.** The simulation work found D=1.00 and C=1.50 across 2023–2025 and framed this as evidence the values are "stable defaults." That framing is wrong. It was coincidental convergence — those seasons happened to produce similar PPM distributions at their respective preseason prices.

The cross-season validation itself showed the problem: 2023 produced +$20.7M driver drift at D=1.00, with the per-season optimal shifting to 1.30. The response was "that's legitimate repricing, not miscalibration" — which is correct. But if that's true, then "stability" across 2024 and 2025 is not evidence of a discovered constant. It's evidence those two seasons had similar competitive stability.

A regulation reset year, a new team entering, or a dramatic mid-grid shuffle will shift the PPM distribution at preseason prices. The neutral that produced near-zero expected drift last season may produce systematic inflation or deflation this season through no fault of the model — just because the grid changed.

**The right approach:** calibrate the neutral point each preseason against the actual PPM distribution of the new grid's expected prices. The question to answer is: given what we've priced each entity at, what neutral produces near-zero expected drift if the season plays out roughly as predicted? That's a well-defined, answerable question before a wheel turns — and it's different for every season.

D=1.00 and C=1.50 are reasonable starting guesses, not fixed inputs.

---

## 7. Band width matters more than neutral point placement

The ±0.30 band thresholds inherited from F1's implementation produced 72% of classifications in the "great" or "terrible" extremes. The middle bands barely existed. The system was effectively binary: maximum step up or maximum step down, most rounds.

Shifting the neutral point does not fix this. The problem is that the actual PPM distribution spans −0.16 to 1.65 for drivers, but a ±0.30 band (0.70–1.30 at neutral=1.00) only covers half that range. Anything outside the middle corridor defaults to an extreme.

Widening to ±0.60 reduced extreme-band concentration from 72% to 50%. Middle bands now contribute 50% of classifications — the inner steps are functional, not decorative.

**The lesson:** Don't inherit band widths from F1's implementation without validating them against your scoring model's actual PPM distribution.

---

## 8. What worked: constructor-context preseason pricing

Pricing rookies at the floor ($2M originally, $6M under revised model) creates a dominant strategy: fill non-elite slots with floor-priced bodies. The floor rookie is cheap enough to include regardless of their actual expected scoring.

The fix: **price rookies at their new team's per-driver average** instead of the floor. A Mercedes rookie inherits a car that scored ~16 pts/race per driver. A Sauber rookie inherits one that scored ~3 pts/race. Pricing them identically was obviously wrong.

**For team changers:** blend individual prior season average with new team's per-driver average using a blend weight (α=0.5 means equal weight to each):

```
adjusted_avg = α × individual_prior_avg + (1 - α) × new_team_per_driver_avg
```

At α=1.0, only the driver's own history is used (the SAI trap — $14.4M for a Williams driver). At α=0.0, only the new team's per-driver average is used (ignores their individual track record entirely). At α=0.5, both are weighted equally. Simulation found α=0.5 minimised total grid mispricing variance. This reduced the SAI trap from $14.4M to a more defensible $9.9M.

Total grid mispricing reduction: from $30.4M to $25.4M (17%). The largest single mispricing dropped from $6.2M (SAI) to $3.0M (LEC, same-team driver).

**Caveat:** constructor-context pricing is an input to preseason pricing, not a complete solution. The α=0.5 formula gives a principled starting point that is better than either extreme, but the actual preseason price will likely require an editorial layer on top — particularly for high-profile team changers, rookies with unusual hype, or regulation reset years where prior season data is a poor predictor of current-season performance. The formula narrows the decision; it doesn't make it.

---

## 9. What worked: dummy race seeding

The original model froze prices for the first 3 rounds (no rolling data yet). This required a special ruleset exception and created a step-change in volatility at R4.

**Dummy seeding** instead seeds the rolling window with 2 dummy entries equal to the driver's preseason per-race average. After R1, window = [dummy, dummy, R1]. After R2, window = [dummy, R1, R2]. After R3+, all real data.

This eliminates the frozen period and its accompanying ruleset exception. The preseason anchor fades naturally. First corrections start after R1 (not R4) but with damping. Early-season mispricing at R1–R8 averaged $18.5M vs $20.5M under frozen period — marginally better, with identical R4+ volatility.

---

## 10. What worked: simulation against real race-by-race data

Every meaningful insight came from running simulations against actual 2025 season data — 24 rounds, real per-race scores for all 20 drivers and 10 constructors.

Abstract analysis (what "should" happen given formula properties) repeatedly failed to anticipate what simulation revealed: floor ratchet asymmetry breaking neutral-step coupling, the 2023 inflation being correct repricing rather than miscalibration, mid-field oscillation emerging from the 3:1 outer/inner step ratio on low-priced entities.

Cross-season simulation (2023, 2024, 2025) was valuable for exposing how parameters behave under different competitive conditions. However, the conclusions drawn from it about parameter stability were undermined by the wrong calibration criterion — near-zero drift was used as the validation metric, which measured the wrong thing. Parameters that "held stable" across seasons did so partly because the metric was insensitive to the distinction between legitimate repricing and miscalibration. Simulation is the right methodology; the results are only as good as the criteria used to evaluate them.

---

## 11. What floor compression means in practice

Floor compression is when multiple entities are pinned at the price floor for most of the season, producing zero price differentiation despite different scoring levels.

In the 2025 direction-based simulation (per-type steps, ±0.60 bands):
- GAS, COL, DOO, BOR, ALO all pinned at $6M for ≥50% of rounds
- GAS: 64 pts, DOO: −7 pts — same price for the full back half of the season
- Players cannot distinguish these entities by price; there is no signal

The cause: at floor price, even bad performance eventually stops pushing price down (can't go below floor), but these entities' PPM is too low to trigger upward movement. They are stranded.

This is structurally inherent to any system with a hard price floor. Floor compression is accepted as a known limitation — backmarker entities are considered genuinely interchangeable by players, so the absence of price signal within the floor tier is acceptable.

The open question is not whether to have a floor but what value to set it at. The floor serves a budget enforcement role — every roster slot must cost something, preventing elite-heavy teams from being built for near-free. The right floor value is a budget mechanics question: how many elite picks should a valid team be able to hold? The floor and budget cap must be decided together to produce the intended team composition constraints.

---

## Summary of what was validated

| Finding | Confidence | Source |
|---|---|---|
| Separate D/C neutral points required | High | 3 independent calibrations, 3 seasons |
| D=1.00, C=1.50 are reasonable starting guesses, not fixed inputs | Low | Coincidental convergence across 2024–2025; neutral must be recalibrated each preseason |
| Band width ±0.60 optimal for our model | High | Sweep of ±0.30–±1.00 |
| Equal window weighting vs recency — no practical difference | High | All window configs within $0.1M avg round |
| Fixed-dollar steps eliminate compounding | High | Theoretical + F1 Fantasy precedent |
| Neutral point and step size cannot be tuned independently | High | Floor ratchet asymmetry confirmed in simulation |
| Constructor-context pricing reduces grid mispricing 17% | Moderate | Single season (2025) validated |
| Dummy seeding slightly better than frozen period | Moderate | Single season (2025) |
| Floor compression is inherent, not fixable via step/band tuning | High | Consistent across all configurations |
| Inner/outer 3:1 step ratio | Low | Inherited from F1, not independently validated |
