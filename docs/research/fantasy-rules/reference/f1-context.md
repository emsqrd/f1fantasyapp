# F1-Specific Context

F1 characteristics that directly affect game design decisions. This is not a general F1 primer — it covers only the aspects that create constraints, edge cases, or calibration requirements for format, scoring, and pricing.

---

## The Grid

**22 drivers, 11 constructors. Exactly 2 drivers per constructor.**

This is fixed by the sporting regulations. Every constructor fields exactly 2 cars, and every driver belongs to exactly one constructor. There are no independent entries. This 2:1 ratio has direct consequences for pool sizing, constructor pricing, and neutral point calibration.

The grid size has been stable at 20 since 2016 and increased to 22 with the addition of Cadillac as an 11th team for 2026. Audi is an existing constructor slot — they took over the Kick Sauber entry. The 22-driver grid is the planning assumption.

---

## The 2:1 Pool Ratio and What It Means for Pricing

With 22 drivers and 11 constructors, the driver pool is exactly twice the size of the constructor pool. This has two design consequences:

**1. Constructor picks are inherently less selective.** Choosing 3 constructors from 11 covers 27% of the pool. Choosing 5 drivers from 22 also covers ~23%. The slot count was chosen to roughly equalize selectivity — without that adjustment, constructors would be even less meaningful picks.

**2. Constructor PPM is structurally higher than driver PPM.** A constructor's score is the sum of both drivers' fantasy points. At a given price, you are buying two scoring assets bundled together. This means constructors will always score more points per million than a single driver at a comparable price — drivers and constructors need separate neutral points. Using the same threshold for both would systematically overprice constructors or underprice drivers. The correct neutral points must be validated against historical data.

---

## Driver and Team Volatility

### Between-season volatility

F1 driver lineups change significantly year to year. Relevant changes at the scale that affect pricing:

- **Driver moves** — Top drivers occasionally change teams (Hamilton to Ferrari in 2025, Sainz to Williams, Antonelli into Mercedes). A driver's price should reflect their new context, not their old one.
- **Rookies** — New drivers entering the grid have no F1 track record. Editorial judgment is required for their initial prices.
- **Mid-season replacements** — A driver replaced mid-season creates a scoring gap. The replacement driver has limited history and must be handled as a late-season rookie.
- **Retirements** — Drivers who leave the sport mid-season are removed from the entry list and will not appear in any future classifications.

### Within-season volatility

Performance swings within a season are a feature of F1, not a bug. Causes:

- **Car development** — Teams develop their cars at different rates. A car that starts the season mid-field can be a front-runner by the summer (McLaren 2024 being the most extreme recent example). Prices should follow this.
- **Power unit reliability periods** — Token systems and upgrade freezes mean some performance changes are permanent once deployed.
- **Driver form** — Even in the same car, driver performance fluctuates. This is the signal PPM is designed to track.

**The implication for pricing:** Large mid-season price swings are correct behavior, not model failure. A driver who moves from scoring 1.5 PPM to 0.4 PPM as their car's development stalls has genuinely changed. The pricing mechanism should track this.

---

## The 2026 Regulatory Change

2026 is the most significant regulatory reset since 2022. Both aerodynamic and power unit regulations change simultaneously:

- **Aero:** Active aerodynamics (moveable front and rear wing elements). Completely new design philosophy.
- **Power unit:** New 50/50 ICE-to-EGU power split. MGU-H removed. MGU-K massively enhanced. All manufacturers start from a new baseline.
- **New entrant:** Cadillac — no F1 car performance history to base pricing on. Audi (formerly Kick Sauber) has prior seasons of data but under a completely new ownership and development direction.

**The design consequence:** Pre-season prices for 2026 will have higher uncertainty than a mid-cycle season. Historical PPM data from 2024–2025 is less predictive than usual. Editorial judgment carries more weight. The in-season PPM mechanism becomes more important as a self-correcting layer.

Major regulatory reset seasons historically produce more DNFs in the early rounds as teams work through reliability issues with new designs.

---

## Season Length

A modern F1 season runs approximately 24 races. This has two direct implications:

- **PPM self-correction:** A mispriced asset has roughly 20+ race weekends to correct after the first few races establish a meaningful rolling average. The in-season mechanism has ample runway to work.
- **Single race weight:** One race represents roughly 4% of the season. A single bad result — or a single great one — should not dominate the pricing signal, which is the core argument for a rolling average over single-race lookbacks.

---

## Sprint Weekends

Sprint weekends occur approximately 6 times per season (the exact calendar varies). They add a sprint race session between qualifying and the main race, scored separately.

**Scoring implications:**

- Sprint weekends generate more total points than standard weekends — there are more sessions to score.
- The sprint race is a shorter, lower-stakes session than the main race. It matters, but should be weighted accordingly — scoring it at full race value would give sprint weekends disproportionate influence on the season.

**Pricing implications:**

- PPM calculations over a rolling window will be uneven if some races are standard and some are sprint. Any given window may contain a mix of weekend types.
- All race weekends are treated as equivalent in PPM calculations. Sprint weekends have a lower points ceiling than standard weekends, but the structure is identical for every asset — no single driver or constructor is disadvantaged relative to others. Sprint points count toward the real F1 championship on equal footing, and they count equally here.

---

## Qualifying vs. Race as Distinct Signals

Qualifying and race performance are partially correlated but not identical. Some drivers systematically over- or under-perform in qualifying relative to race pace:

- **Qualifying specialists** — Drivers who extract maximum one-lap pace but manage tyres or strategy less well in race conditions. Their qualifying score contribution is disproportionate to their race contribution.
- **Race pace specialists** — Drivers who qualify lower than expected but move up through the field via racecraft and tyre management.
**The implication for pricing:** A driver known as a qualifying specialist at a budget price is still a viable pick; they score from qualifying even if their race position is lower. This matters for preseason price calibration — raw historical race results undervalue qualifying-specialist drivers.

---

## DNF Frequency and Distribution

DNFs are a structural part of F1 and affect pricing, scoring volatility, and team composition strategy.

### Season-level patterns

- **Distribution is not uniform:** Backmarker teams and teams with known reliability issues produce more DNFs than front-runners. New regulation years historically see elevated DNF rates across the field as teams work through reliability issues with new designs.
- **Sprint DNF rates are lower** than race DNF rates — the sprint is shorter, so there is less exposure time for mechanical failures and incidents.

### Pricing consequences

DNF rates affect PPM in two ways:
1. **Direct:** A DNF race produces 0 finish points, dragging down the rolling PPM average.
2. **Structural:** Habitually unreliable drivers will have systematically lower PPM than their on-track pace would suggest. This is correct behavior — reliability is part of value. The pricing mechanism should not try to "correct" for DNFs separately.

### FIA classification is authoritative

The FIA race classification determines DNF status — not whether a driver physically retired from the race. A driver who retires but has completed 90%+ of race distance may still receive a classified finishing position under FIA rules. A driver listed as DNS, DNF, or DSQ is unclassified regardless of how far they got.

