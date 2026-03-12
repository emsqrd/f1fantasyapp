# Scoring Simulation Plan

## Goal

Validate candidate scoring point values against historical F1 results (2025 season) to confirm they produce the desired player experience outcomes.

## Validation Criteria

Against design goals, the simulation should confirm:

1. **Moderate skill ceiling** — mid-field picks are viable; top drivers don't create an insurmountable gap
2. **Moderate volatility** — single races represent 15–20% of season points max
3. **Constructor strategy** — three-layer model creates genuine differentiation; mid-field constructors occasionally outscore top teams
   - Watch for **bonus layer dominance**: for mid-field constructors, Layer 2 + Layer 3 can represent 70%+ of total score. If bonus layers routinely dwarf Layer 1 scoring, the base table may need reweighting or the bonus values scaling down.
   - Watch for **Layer 3 cliff at 6 positions**: a 5-gap earns +3, a 6-gap earns 0. Flag any races where this boundary produces results that feel unfair or arbitrary.
   - Watch for **constructor vs. driver proportion**: constructors should represent ~25%+ of a well-built team's total season points. Below that, they feel like an afterthought despite the three-layer model.
4. **No dominant always-picks** — no driver or constructor consistently scores so far ahead they're always correct
5. **Position gain bonus calibration** — a driver starting P20 and finishing P10 earns +20 in gains alone, nearly matching a race win. Check whether backmarker drivers who occasionally make big moves are inflated enough to distort picks relative to their price.
6. **Sprint weekend scoring differential** — constructors score from both sprint and main race sessions. Quantify how much larger sprint weekends are vs. standard weekends and confirm the main race still dominates within each weekend.
7. **Captain pick variance** — if the optimal captain is the same driver every race, the weekly engagement value of the mechanic is undermined. Check race-to-race variance in who the top captain pick would have been.
8. **DNF penalty calibration** — verify -10 lands as "noticeable but not season-ending." Pick a driver who had a historically unreliable season and check whether their fantasy value is so crushed by accumulated penalties that they'd never be viable regardless of price. If yes, the penalty is too harsh.
9. **Season runaway risk** — simulate a "best possible team locked in at race 1" scenario and track the cumulative points gap it opens over the season. If an optimal early team becomes effectively uncatchable by mid-season, the scoring model (or transfer mechanic) may need adjustment to keep the season competitive through the final rounds.

## Approach

1. Gather 2025 race-by-race results (all sessions)
2. Apply scoring rules to each race
3. Aggregate season totals
4. Analyze distributions against criteria
5. Adjust point values if necessary

## Data Required

For each of the 24 races in 2025:

- Qualifying classification (positions)
- Race grid positions (after grid penalties applied — needed for position gain bonus)
- Main race classification (finishing positions, DNF/DSQ status, fastest lap)
- Sprint race classification (if applicable; grid positions and race results)
- Constructor rosters (both drivers per team)

## Output

- Spreadsheet with per-race and season scoring for all drivers and constructors
- Analysis report against design goals
- Recommendations for point value adjustments (if any)

## Next Steps

1. Source 2025 race data
2. Build scoring calculation script
3. Run simulation
4. Review results and adjust if needed
5. Proceed to pricing with validated values
