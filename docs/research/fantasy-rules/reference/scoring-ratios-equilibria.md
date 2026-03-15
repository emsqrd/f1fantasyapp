# Scoring Ratios & Equilibria

Key ratios and equilibrium checks for evaluating whether scoring values are internally consistent and aligned with design goals. These should be validated against simulation output before finalizing values.

---

## 1. Session Weight Ratio (Qualifying : Sprint : Race)

Current P1 values: **10 : 8 : 25**

| Weekend type   | Qualifying | Sprint | Race | Quali share | Sprint share |
| -------------- | ---------- | ------ | ---- | ----------- | ------------ |
| Standard       | 10         | —      | 25   | 29%         | —            |
| Sprint weekend | 10         | 8      | 25   | 23%         | 19%          |

Qualifying contributing ~29% of total weekend points means a strong qualifier who DNFs still brings points home — this directly reduces single-race volatility and aligns with the design goal of "individual races matter, but the season is the campaign."

If qualifying weight is too high, race results feel like a formality. If too low, the pre-race captain decision (which doubles all weekend points including qualifying) loses strategic weight.

---

## 2. DNF Penalty vs Average Race Score

The DNF penalty is the primary lever for volatility. The key number is the swing from expected score to DNF score.

| Driver type               | Expected weekend | DNF weekend | Swing     |
| ------------------------- | ---------------- | ----------- | --------- |
| Midfield (P7 race, P6 Q)  | ~13 pts          | ~−5 to −10  | ~20–25 pt |
| Front-runner (P3 race, P3 Q) | ~24 pts       | ~−2 to −10  | ~26–34 pt |

A ~20–25 point swing means one unrecovered DNF costs roughly one race worth of scoring. Over 24 races, 3–4 extra DNFs create an unrecoverable gap — "noticeable without being catastrophic," as intended.

**Comparison:** Official F1 Fantasy uses −20 (race), producing a 35–40 point swing — much more punishing. Our −10 is deliberately conservative.

**Watch for:** If the DNF penalty is too low, volatile drivers become free upside with negligible downside. If too high, players avoid all midfield risk and the meta collapses to safe front-runner picks only.

---

## 3. Driver Slot vs Constructor Slot Value (Per-Slot Equilibrium)

With 5D + 3C, the per-slot scoring contribution should reflect the intended strategic weight of each slot type.

Using worked examples from the scoring doc:

| Asset type  | Typical weekend range | Slots | Points/slot |
| ----------- | --------------------- | ----- | ----------- |
| Driver      | 3–35 pts              | 5     | ~10–15      |
| Constructor | 10–53 pts             | 3     | ~15–25      |

Constructors are worth roughly **1.5–2× per slot** compared to individual drivers. This is the intended range: high enough that constructor selection carries real strategic weight across 3 slots, low enough that drivers still dominate overall team composition. If constructors drift above 2×, they monopolize strategy; below 1.5×, they feel like afterthoughts.

---

## 4. Position Gain Value vs Finish Points

Position gains (+1 per position) interact with finish points to determine how much a "mover" is worth relative to a "finisher."

**Example:** P15 start → P8 finish: +7 position gain + 5 finish = **12 pts**
**Comparison:** P3 qualifier who finishes P3: 0 position gain + 16 finish = **16 pts**

To match a P3 finisher via position gains alone, a driver would need to gain ~11 positions — which is uncommon. This means position gains are a supplement, not a substitute, for strong finish position.

Position gains are most valuable in the midfield (where finish points are flat) and least valuable for front-runners (where finish points are steep). This naturally rewards the "scrappy midfield pick" without making grid chaos an exploitable strategy.

---

## 5. Sprint Weekend Scoring Inflation

Sprint weekends produce more total points, inflating their strategic weight.

| Weekend type | Max P1 score | vs standard |
| ------------ | ------------ | ----------- |
| Standard     | ~35 pts      | baseline    |
| Sprint       | ~43 pts      | +23%        |

With ~6 sprint races per 24-race season (~25% of races), sprint weekends contribute ~28% of total available points — a mild overweight. Captain picks, transfer timing, and roster decisions around sprint weekends carry slightly more strategic importance than their race count implies.

---

## 6. Points-per-Million (PPM) Equilibrium — Pricing Dependency

The meta-equilibrium that ties scoring to pricing. If every asset had identical PPM, there would be no interesting decisions. The game lives in PPM variance.

- Expensive drivers should have slightly **lower PPM** than cheap ones — you pay a premium for consistency and ceiling.
- If top drivers have equal or higher PPM than budget picks, they dominate; if far lower, budget stacking becomes the only viable strategy.

This ratio cannot be evaluated until pricing is calibrated against simulated scoring data. It is the final validation check, not a design input.

**Validity check (from design-framework.md):** Can you construct five or more meaningfully different competitive teams under the budget cap? If yes, PPM balance is working.

---

## Summary: Which Ratios to Watch in Simulation

| Ratio | Drives | Alert if... |
| ----- | ------ | ----------- |
| DNF swing (20–25 pts) | Volatility | < 15 pts → volatile picks become free upside; > 35 pts → meta collapses to safe picks |
| Constructor per-slot (1.5–2×) | Format balance | < 1.2× → constructors feel irrelevant; > 2.5× → constructors dominate |
| Sprint weekend inflation (~23%) | Transfer timing | > 30% → sprint weekends become must-optimize events |
| PPM variance | Pricing calibration | < 5 truly different viable teams → constraint is too tight or not tight enough |
