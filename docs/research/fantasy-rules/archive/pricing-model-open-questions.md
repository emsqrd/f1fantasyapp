# Pricing Model — Open Questions & Design Tensions

**Status:** Commit 3 (validation) complete. All P1–P6 pass. Now facing design questions that affect preseason pricing strategy.

**Date:** 2026-03-05

---

## The Core Problem: Formula-Driven vs. Editorial Pricing

### What we built

- **Power Curve formula** (shape=1.0): converts previous season's per-race average → preseason price
- **$115M budget cap** at 130% tightness
- **Dynamic pricing**: 3-race rolling average corrects prices in-season

### What the data shows

1. **Our formula underprices team context.** ANT (rookie in Mercedes) gets floor price ($2M) despite HAM leaving a seat that averaged 12.8 pts/race in a top-2 constructor. Meanwhile BOR (rookie in Sauber) also gets floor price despite the car averaging only 2.3 pts/race.

2. **Real platforms don't appear to use a simple backward-looking formula.** Sportsdeck started ANT at $12.5M (reflecting Mercedes seat + hype) vs BOR at $3M floor. F1 Fantasy 2026 preseason prices RUS #2 despite him finishing 4th in 2025 — the reasoning behind that choice is unknown, but it doesn't match last season's results.

3. **The budget structure creates a dominant strategy:** Keep as many elite drivers as you can afford + fill the rest with floor-priced rookies. Constructor slot is always McLaren + Mercedes + cheapest (Williams). No interesting mid-tier decisions.

---

## Specific Design Issues

### Issue 1: Rookie Pricing

**Current:** All rookies at $2M floor, regardless of team.

**Reality:** Rookie scoring potential depends heavily on car quality.

- A Mercedes rookie inherits a car that scored 623 constructor pts
- A Sauber rookie inherits a car that scored 56 constructor pts
- Same player, ~11x different scoring potential

**Impact:** ANT ends season with 303 pts and 69.2 pts/$M — massive value that was invisible at $2M preseason. But hindsight is 20/20; the real problem is the preseason signal was backwards.

**Options:**

1. Price rookies at team-adjusted floor (e.g., $2M + constructor strength factor)
2. Manual seeding (Sportsdeck approach): set each rookie's preseason price by hand
3. Keep $2M floor, accept the mispricing, rely on dynamic pricing to correct it by round 4–6

### Issue 2: Team Changes

**Current:** Drivers priced on their 2024 individual output regardless of team move.

**Examples:**

- HAM → Ferrari: priced $12.8M based on 2024 Mercedes average
- SAI → Williams: priced $13.5M based on 2024 Ferrari average
- RUS stays Mercedes: priced $12.9M (same constructor context as 2024)

**Impact:** How much these moves matter to pricing is unknown without investigating actual 2025 preseason prices. The formula doesn't account for them at all.

**Options:**

1. Keep formula-driven, accept the lag, rely on dynamic pricing
2. Manually adjust drivers who changed teams before season starts
3. Build team-context into the formula (rookie pricing already touches this)

### Issue 3: Dominant Strategy in Team Composition

**Current state at $115M cap:**

- Best team: VER, NOR, PIA, RUS (4/5 dream drivers) + ANT (floor) + McLaren, Mercedes, Williams
- You keep the top 4 drivers. Drop only LEC. Fill with the cheapest bodies.

**At $110M cap:**

- Best team: NOR, PIA, RUS, HAM (3/5 dream drivers) + ANT + McLaren, Mercedes, Williams
- VER ($19M) gets priced out. But the pattern is identical: maximize stars + minimize filler.

**At all caps:** Constructor slot is always McLaren + Mercedes + Williams. Ferrari never competes because $24.6M for 607 pts can't beat $3M for 191 pts when you're budget-constrained.

**Root causes:**

1. **Huge gap between elite and filler.** Elite drivers: $13–19M. Rookies: $2M. Almost nothing in between that's compelling.
2. **Constructor pricing range too wide.** $3M–$25M. The bottom is nearly free, so the third slot always goes to the cheapest option regardless of its quality.
3. **No viable mid-tier picks.** HUL ($4.9M, 210 pts) vs ANT ($2M, 303 pts)? ANT wins despite being a rookie. TSU ($4.2M, 239 pts) vs ANT? ANT wins again.

**Impact on gameplay:** The lineup feels settled preseason (pick the stars) rather than offering meaningful tradeoff decisions. The budget cap matters less for strategy ("which stars to keep") and more for execution ("which exact elite combo fits").

---

## What Real Platforms Do

**F1 Fantasy (official, 2026 preseason):**

- Top 4 prices: VER, RUS, NOR, PIA
- Not reflective of 2025 final standings (RUS finished 4th)
- Their preseason pricing methodology is unknown — they don't publish it
- **In-season pricing** has been reverse-engineered by the community (f1fantasytools.com): purely performance-driven PPM buckets over a 3-race rolling window, with tiered step changes (not continuous). No demand/transfer signal.
- Notably, F1 Fantasy used demand-driven (hourly) pricing in 2020–2021 and abandoned it in favour of performance-only pricing, likely due to instability at scale.

**Sportsdeck:**

- 2025 preseason: ANT priced at $12.5M (rookie in Mercedes), BOR at $3M floor
- Suggests team context influences pricing, but their full methodology is unknown
- In-season pricing mechanism is undocumented

---

## Decision Points

### For next phase, choose between:

**A) Stay formula-driven (current approach)**

- Pros: Transparent, rule-based, no human judgment required each season — actually an advantage over F1 Fantasy, whose methodology is entirely opaque to players
- Cons: Preseason prices are obviously wrong in predictable ways (team changes, rookies); early-season gameplay feels solved
- Mitigation: Acknowledge it in docs, lean on dynamic pricing for correction

**B) Hybrid: formula + editorial adjustments**

- Pros: Formula provides baseline, editorial fixes obvious cases (team changes, rookie hype), still mostly automated
- Cons: Requires judgment calls each preseason, harder to explain pricing consistently
- Effort: Low-medium, pick a few clear override rules

**C) Smarter formula: incorporate team context**

- Pros: More sophisticated, captures more F1 logic, still rule-based
- Cons: More complex formula, harder to understand, need to define "team strength" (constructor avg? weighted recent form?)
- Effort: Medium-high, but runs itself

**D) Full editorial seeding (possibly similar to F1 Fantasy)**

- Pros: Best gameplay outcomes, aligns with real platform, room for hype/narrative
- Cons: Requires deep F1 judgment each season, not formula-driven, more work
- Effort: Medium, subjective

---

## Architectural Notes

- Current code: `pricing.py` has `compute_preseason_price()` that's purely formula-driven
- Dynamic pricing (`compute_price_change()`) is solid and does correct obvious errors by round 4–6
- If you go B or C: still keep dynamic pricing, just improve the starting point
- If you go D: replace `compute_preseason_price()` with a manual override dict or editing UI

---

## Next Steps to Investigate

1. **Analyze 2025 actual preseason prices** (if available) — what did F1 Fantasy actually price ANT, RUS, HAM, SAI at? (2026 preseason prices known for top 4: VER, RUS, NOR, PIA — full grid unknown)
2. **Compare against our formula output** — quantify the mispricing
3. **Decide if early-season mispricing is acceptable** — how bad does it feel? Does dynamic pricing fix it fast enough?
4. **Sketch option B or C** — if you want to improve the formula, what's the minimal change that helps?
5. **Consider team composition** — is 5D+3C the right shape? Does 6D+2C or 4D+4C change the strategy in a good way?

---

## Related Open Questions

- **Should rookie floor be higher?** $2M → $5–6M would eliminate the "fill with floor-priced bodies" strategy entirely
- **Should constructor floor be higher?** $3M → $5M would make the third constructor slot cost something
- **Does $110M or $115M cap feel right?** Budget sweep suggests $110M forces more interesting driver decisions (VER gets priced out), but still same constructor pattern
