# Pricing

## Context

Initial pricing and budget cap need to be set before launch. Price changes over the season can come later. Pricing depends on the format and scoring decisions.

## Decisions Needed

1. Budget cap
2. Initial driver prices
3. Initial constructor prices
4. Price change mechanism (post-launch, not needed for launch)

## Reference

See `../competitors/` for how each platform handles pricing. Key findings from competitor analysis:

- $100M budget cap is the de facto standard (F1 Fantasy, GridRival)
- GridRival's published pricing formula is a confirmed trust differentiator — players praise the transparency
- SportsDeck's formula: `starting_price = round_100K(262,000 × previous_average)` with a $3M floor; see `../sportsdeck-pricing-formula.md` for full details
- Pricing should correlate with expected scoring so obvious picks are expensive enough to force trade-offs

## Our Pricing

TBD — pending format and scoring decisions; pricing is calibrated last against simulated scoring data
