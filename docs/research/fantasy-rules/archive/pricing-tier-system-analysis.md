# Tier System Analysis — Design Goals vs Implementation

**Status:** Clarification document
**Date:** 2026-03-11
**Context:** Discussion of whether a tiered pricing system aligns with stated game design goals

---

## The Question

The direction-based PPM model simulation tested tiered pricing (A=75%/B=150% with D≥$15M, C≥$21M breakpoints). Do tiers serve the game's design goals, or are they inherited from F1 without justified rationale for our model?

---

## Stated Game Design Goals

1. **Prevent rich-get-richer dynamics** — Most expensive drivers/constructors shouldn't be auto-picks
2. **Mid-pack and backmarkers viable** — Cheaper entities should be legitimate roster options
3. **Buy-low reward** — A player spotting underpriced talent should be rewarded when it rises
4. **Price mobility** — Entities should be able to rise to top-tier or fall from it (no permanent positioning)

---

## How the Core PPM Model Serves These Goals

**Rich-get-richer prevention:** The PPM feedback loop already handles this.
- As price rises, PPM falls (same points, higher denominator)
- Eventually PPM drops below neutral, triggering price decreases
- The simulation showed this works — McLaren peaked at $29.4M then self-corrected to $27.6M without a hard ceiling
- **This mechanism is independent of tiers**

**Buy-low reward:** Inherent to PPM.
- A cheap entity performing well has high PPM (low denominator)
- Price rises automatically
- No tier system needed for this behavior

**Price mobility:** The simulation showed entities rising ($13.7M RUS → $19.2M) and falling ($10.7M TSU → $8.1M) naturally through the PPM mechanism.

---

## What Tiers Actually Do

Tiers set different step sizes for expensive (A-tier) vs cheap (B-tier) entities.

**Per-type uniform (no tiers):** All drivers get +$0.50M per "Great," −$0.50M per "Terrible"

**Tiered (A=75%/B=150%):**
| Band | A-tier (≥$15M) | B-tier (<$15M) |
|------|---|---|
| Great | +$0.40M | +$0.80M |
| Good | +$0.10M | +$0.30M |
| Poor | −$0.10M | −$0.30M |
| Terrible | −$0.40M | −$0.80M |

**Effect:**
- B-tier entities move faster — cheap performers rise quicker
- A-tier entities move slower — expensive entities are more stable

---

## The Misalignment with Game Goals

### A-tier dampening protects expensive entities from falling

A "Terrible" rated expensive driver loses only $0.40M (vs $0.80M uniform). This **slows relegation** — working against the goal of "top entities can be demoted."

Example: A $18M driver rated "Terrible" only drops 2.2% vs 4.4% under uniform steps. They're less likely to fall to mid-tier pricing.

### B-tier amplification + floor creates oscillation

- A cheap entity rated "Great" gains +$0.80M per round
- Rated "Terrible" loses $0.80M per round (but floor at $6M absorbs the downside)
- Result: bouncing between $6M and ~$9M rather than smooth trajectories
- **However:** This may be legitimate performance volatility being reflected. The 3-race window already smooths single-race anomalies, and the simulation doc acknowledged genuine performance swings should produce price swings.

---

## Where Tier Parameters Came From

**The breakpoints (D≥$15M, C≥$21M):** Selected from a 25×5×5 grid sweep (tier boundaries × D boundaries × C boundaries) because they produced the lowest total drift (+$0.2M D, $0.0M C).

**The multipliers (A=75%, B=150%):** Selected from a sweep of 3×3 multiplier combinations. The fractions (50%, 67%, 75% for A; 100%, 150%, 200% for B) were evenly-spaced round numbers covering a plausible range — no structural derivation.

**Key insight:** Both were optimized for drift minimization. But drift isn't inherently bad — legitimate performance changes produce drift.

---

## Why F1 Might Use Tiers (But You May Not Need Them)

F1 Fantasy is a **mass-market casual game**. Tiers likely serve product/UX goals:

1. **Casual player retention** — Famous expensive drivers (VER, NOR) are stable so casual fans don't get punished for picking favorites
2. **Reduce decision frequency** — Stable expensive entities mean casual players can set-and-forget their core roster
3. **Casual-core split** — Casual players have a stable experience; engaged players optimize B-tier bargains

Your design goals (competitive depth, meaningful tradeoffs, buy-low, relegation) suggest a different audience — **engaged players** rather than casual. The tier system's A-tier protection works against that.

---

## The Core Issue

**You've been optimizing the wrong thing.** The simulation swept tier parameters to minimize drift, but drift itself reflects legitimate game dynamics. You can't optimize tiers without first deciding:

1. What should the step size accomplish? (correction speed? stability? something else?)
2. Should expensive entities be more stable or face the same correction rate as cheap ones?
3. Is the goal to reach a specific drift target, or to achieve specific gameplay behaviors?

The current tiered approach was chosen because it minimized drift, not because it was justified against your game design goals.

---

## Recommendations for Fresh Start

1. **Decide: do you need tiers?** Given that the PPM feedback loop already prevents rich-get-richer, and you want relegation, the A-tier protection may work against your goals. Test whether **uniform per-type steps** achieve your goals without tiers.

2. **If tiers are needed,** define why. Don't optimize on drift. Instead:
   - Decide what percentage change each band should produce (e.g., "Great = 5% of current price")
   - Derive dollar steps from that principle
   - Set boundaries based on where the player base naturally clusters in the price distribution (not drift minimization)

3. **Validate differently.** Rather than checking "is drift minimized?", check:
   - Can a cheap player who spots value see a steady rise? ✓/✗
   - Can a top-tier entity fall to mid-tier? ✓/✗
   - Does the model produce the competitive balance you want? ✓/✗

---

## Open Questions

- Is the uniform per-type approach sufficient for your goals without tiers?
- If tiers are needed, what's the structural reason (not drift-based)?
- How sensitive is the outcome to tier boundaries? (The simulation found low sensitivity — maybe the exact boundary doesn't matter)
