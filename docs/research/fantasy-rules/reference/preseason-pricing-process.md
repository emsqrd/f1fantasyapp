# Preseason Pricing Process

How to generate the 33 entity prices before each season. This is an internal process — not published to players.

## Formula Baseline

Prior-season scoring data is mapped to prices using a formula as a starting point. The formula's scale is tuned so the resulting price distribution enforces the [composition intent](../decisions/format.md) within the [budget cap and price floor](../decisions/pricing.md).

The exact formula shape and parameters are calibrated against real scoring data.

## Special Cases

- **Rookies** (no prior-season data): priced at their new team's per-driver average.
- **Team changers**: priced at a blend of individual prior-season average and new team's per-driver average.
- **New teams** (no team history): seeding rule TBD.

## Editorial Review

After the formula produces 33 baseline prices (including special cases), review them as a sanity check against the known competitive landscape. The goal is to catch obvious mispricings the formula can't handle structurally — not to predict performance.

**What to look for:** Prices that are clearly wrong given what you know about the grid. Common causes:

- A team changer whose blend weight didn't pull far enough toward their new team's level (e.g., an elite-team driver moving to a backmarker team still priced too high)
- A rookie whose team average doesn't reflect their expected role (rare — the team average rule usually handles this)
- A constructor where a major regulation change or technical restructuring makes prior-season data misleading

**How to assess:** Group the 33 formula prices into three tiers to check the overall shape:

- **Elite** — expected to compete at the front
- **Midfield** — expected to score points regularly
- **Backmarker** — expected to be outside the points

If an entity landed in a tier that doesn't match its known competitive position, adjust it into the correct tier range. Most entities will be fine — expect 5–8 adjustments at most.

**Pre-season testing as a secondary signal:** Testing consensus from credible analysts can confirm or occasionally reveal something the formula missed. However, testing data is noisy (sandbagging, different programs, unknown fuel loads) and should be weighted accordingly:

- **Upward moves are safer.** Genuine pace is hard to fake. If consensus says a team has made a real step forward, that's a reasonable basis to promote.
- **Downward moves require structural evidence.** Poor testing pace alone is not enough to demote — well-funded teams sandbag, run reliability programs, or simply have bad tests. Only demote for structural reasons (team confirmed to be rebuilding, regulatory issues, etc.).
- **When in doubt, don't adjust.** PPM self-corrects within 2–3 races. The cost of a wrong preseason price is small and temporary.

## Rounding

Prices round to the nearest $0.1M.

## Floor Enforcement

Any price that falls below the price floor after formula + adjustments is set to the floor.
