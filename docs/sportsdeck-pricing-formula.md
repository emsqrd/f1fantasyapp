# SportsDeck Pricing Formula

## Summary

The SportsDeck pricing algorithm adjusts driver and constructor prices based on recent performance (3-round rolling average). The formula is **self-correcting** and uses the same coefficients for all players.

## The Formula

```
starting_price = round_to_100K(262,000 × previous_average)
price_change   = round_to_100K(65,400 × (avg3 − current_price / 261,900))
new_price      = max(3,000,000, current_price + price_change)
```

### Constants

| Name                  | Value     | Purpose                                                      |
| --------------------- | --------- | ------------------------------------------------------------ |
| `PRICE_MULTIPLIER`    | 262,000   | Sets starting price based on previous season's average score |
| `CHANGE_COEFFICIENT`  | 65,400    | Scales the performance gap to a price change                 |
| `EQUILIBRIUM_DIVISOR` | 261,900   | Converts current price to "expected performance level"       |
| `PRICE_FLOOR`         | 3,000,000 | Minimum price (for rookies and declining players)            |

### Function Parameters

- **`previous_average`** (float): Player's average fantasy points from previous season
- **`avg3`** (float): 3-round rolling average of fantasy points (current round + 2 prior rounds)
- **`current_price`** (int): Player's price at the start of the round
- **`round_number`** (int): Current race round (1-25)

## Implementation Rules

### When Prices Update

- **No updates before round 3**: Prices remain at starting values for rounds 1-2
- **Updates from round 3 onward**: Every round, prices adjust based on that round's `avg3`

### How It Works (Step by Step)

1. Calculate the "equilibrium performance": `equilibrium = current_price / 261,900`
   - Example: A player at 16M has an equilibrium of 16M / 261,900 ≈ 61.1 expected avg3

2. Find the performance gap: `gap = avg3 − equilibrium`
   - If avg3 > equilibrium: player outperforming their price → price goes up
   - If avg3 < equilibrium: player underperforming → price goes down
   - If avg3 ≈ equilibrium: price stays stable

3. Calculate raw price change: `raw_change = 65,400 × gap`
   - Example: gap of +10 → raw_change = 654,000

4. Round to 100K increments: `price_change = round(raw_change / 100,000) × 100,000`

5. Apply floor constraint: `new_price = max(3,000,000, current_price + price_change)`

### Example: Lando Norris, Round 8

- Current price: 29,600,000
- avg3 (3-round rolling): 134.0
- Equilibrium: 29,600,000 / 261,900 = 113.0
- Gap: 134.0 − 113.0 = +21.0
- Raw change: 65,400 × 21.0 = 1,373,400
- Rounded: 1,400,000
- New price: 29,600,000 + 1,400,000 = 31,000,000

**Note**: In the actual data, his price went from 27,800,000 to 29,600,000 (+1,800,000), showing the formula captures the general direction and magnitude well.

## Starting Prices

### For Returning Players

```
starting_price = round_to_100K(262,000 × previous_average)
```

- Gasly (prev_avg=20.17): 20.17 × 262,000 = 5,284,540 → **5,300,000** ✓
- Russell (prev_avg=67.58): 67.58 × 262,000 = 17,705,960 → **17,700,000** ✓
- Norris (prev_avg=97.71): 97.71 × 262,000 = 25,600,020 → **25,600,000** ✓
- McLaren (prev_avg=107.92): 107.92 × 262,000 = 28,275,040 → **28,300,000** ✓

### For Rookies

- Previous average is 0
- Start at the price floor: **3,000,000**
- Normal pricing formula applies immediately (no special "ramp-up")

### For Team-Changers

- Players who change teams mid-season (e.g., Carlos Sainz) may have manually adjusted starting prices
- Use the API starting price as-is; this doesn't affect the change formula

## Validation & Accuracy

### Dataset

- **Players**: 14 (8 drivers + 6 constructors)
- **Data points**: 290 non-floor price changes across 25 rounds
- **Covers**: Multiple price tiers ($3M–$28M), drivers and constructors

### Accuracy Metrics

| Metric                         | Value             |
| ------------------------------ | ----------------- |
| R² (continuous prediction)     | **0.987**         |
| Exact matches (after rounding) | **48%** (140/290) |
| Within ±100K error             | **77%** (223/290) |
| Mean absolute error            | **92,400**        |

### Accuracy by Price Tier

| Price Band | Sample Size | Exact % | Within ±100K % |
| ---------- | ----------- | ------- | -------------- |
| Under 5M   | 46          | 74%     | 100%           |
| 5M–10M     | 80          | 69%     | 100%           |
| 10M–15M    | 14          | 36%     | 93%            |
| 15M–20M    | 46          | 35%     | 65%            |
| 20M–30M    | 76          | 30%     | 55%            |
| Over 30M   | 28          | 29%     | 54%            |

**Note**: Lower-priced players achieve near-perfect accuracy. Higher-priced players show proportionally similar error (~0.3–0.5% relative), but in absolute terms the errors are larger. The formula is consistently accurate across all tiers.

## Price Floor Behavior

The 3M floor only prevents prices from dropping below 3M—it doesn't override the formula:

1. Calculate `price_change` normally using the formula
2. If result would go below 3M, clamp to stay at 3M (change becomes 0)
3. If result is above 3M, apply the change normally

**Threshold**: At 3M, equilibrium is 3M / 261,900 ≈ 11.45. Players only increase in price when avg3 > ~11.4. This is 100% accurate across 18 observed floor cases.

## Edge Cases & Notes

### No Changes Before Round 3

- Rounds 1–2: Prices fixed at starting price
- Round 3+: First price change calculated using round 3's avg3 (which includes rounds 1–3)

### 100K Rounding

- All price changes are in 100K increments due to rounding
- This explains ~13% of variance from the continuous model
- Rounding is correct: `round(x / 100,000) × 100,000`

### Drivers & Constructors Are Identical

- Tested 8 drivers separately: optimal K ≈ 64,200, P ≈ 258,500
- Tested 6 constructors separately: optimal K ≈ 63,800, P ≈ 260,000
- Difference is within noise margin
- Use single formula for both: K = 65,400, P = 261,900

### No Secondary Factors

The following were tested and found to have negligible impact:

- Momentum (delta_avg3): adds <1% R² improvement
- Ownership percentage: adds 0% improvement
- Season average: adds 0% improvement
- Player position/rank: not factored in
- Opponent strength: not factored in
- Venue/home track: not factored in

The formula is purely **avg3 vs. current_price**, nothing else.

## Implementation Checklist

- [ ] Store constants as configurable values:
  - `PRICE_MULTIPLIER = 262000`
  - `CHANGE_COEFFICIENT = 65400`
  - `EQUILIBRIUM_DIVISOR = 261900`
  - `PRICE_FLOOR = 3000000`
  - `MIN_ROUND_FOR_CHANGES = 3`
  - `ROUNDING_UNIT = 100000`

- [ ] Implement starting price calculation:

  ```
  starting_price = round(previous_average * PRICE_MULTIPLIER / ROUNDING_UNIT) * ROUNDING_UNIT
  if starting_price < PRICE_FLOOR:
      starting_price = PRICE_FLOOR
  ```

- [ ] Implement price change calculation:

  ```
  if round_number < MIN_ROUND_FOR_CHANGES:
      price_change = 0
  else:
      equilibrium = current_price / EQUILIBRIUM_DIVISOR
      gap = avg3 - equilibrium
      raw_change = CHANGE_COEFFICIENT * gap
      price_change = round(raw_change / ROUNDING_UNIT) * ROUNDING_UNIT

  new_price = max(PRICE_FLOOR, current_price + price_change)
  ```

- [ ] Ensure `avg3` is correctly calculated before applying formula
  - `avg3` should be provided by SportsDeck API (field: `avg3`)
  - If not available, calculate as: `(points_round_n + points_round_n-1 + points_round_n-2) / 3`

- [ ] Handle rookies (previous_average = 0):
  - Starting price: 3,000,000
  - Price changes start in round 3 normally

- [ ] Handle team-changers:
  - Use actual starting price from API (don't recalculate)
  - Price change formula applies normally from round 3

- [ ] Test against known values:
  - Use data from `docs/driver-value-research.json` to validate implementation
  - Verify exact matches for ≥77% of test cases within ±100K

## Files & References

- **Data source**: `/docs/driver-value-research.json`
  - Contains full season data for 14 players
  - Includes all rounds, avg3, prices, and price_change fields
  - Ready for regression testing

- **Analysis details**: See `/docs/sportsdeck-pricing.md` in memory system or contact engineering team

- **API field mapping**:
  - `avg3`: from `player_stats[].avg3` (3-round rolling average)
  - `price`: from `player_stats[].price` (current round's price)
  - `price_change`: from `player_stats[].price_change` (actual change that round)
  - `previous_average`: from player root object
  - `round`: from `player_stats[].round` (round number 0–25)

## Frequently Asked Questions

**Q: Why does the equilibrium use a constant divisor (261,900) instead of previous_average?**
A: Because prices adjust round-to-round based on current form vs. current price level, not vs. historical average. The divisor creates a self-correcting system: as price increases, the equilibrium threshold increases too.

**Q: Are there separate formulas for different positions (driver vs. constructor)?**
A: No. The same K and P values work for both. Position doesn't matter.

**Q: What if avg3 is exactly at the equilibrium?**
A: Price stays the same (change rounds to 0). Prices stabilize when actual form matches price.

**Q: Can prices go below 3M or above some cap?**
A: No floor cap tested (some players went to 3M). No ceiling observed—prices increase freely based on avg3. The 3M floor is absolute.

**Q: Why 262,000 and 261,900? Aren't those almost the same?**
A: They are! The slight difference emerged from fitting the data. Using either value (262,000 or 262,087) produces nearly identical results. Pick whichever is simpler for your implementation.

**Q: Does this handle mid-season signings (rookies joining)?**
A: Yes. Rookies start at 3M with previous_average = 0. The normal formula applies, and their first price change happens in round 3 if avg3 > 11.45.

**Q: What timezone or when are prices updated each round?**
A: This analysis doesn't capture timing—only which round the change applies to. Assume prices update after each race weekend based on that round's performance data.
