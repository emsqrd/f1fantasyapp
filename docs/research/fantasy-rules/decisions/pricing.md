# Pricing

How entity prices are set before the season and how they change during it.

---

## Budget Cap

The budget cap ($100M) is defined in `format.md`. Pricing interacts with it as follows: assets are bought and sold at current market prices, and a team's total market value can exceed the cap as prices appreciate. See `rules.md` for full budget management mechanics.

## Price Floor

**$4.5M.** The minimum price any entity can hold.

The floor is a safety net, not a tier — only 2–3 entities should land there in a typical season. Floor compression among bottom-tier entities is accepted by design: backmarker entities are considered interchangeable for team-building purposes.

The floor also defines the lower bound of the backmarker tier ($4.5–8M). At $5M, validation showed too many entities stacking at the floor; $4.5M provides enough runway for underperforming entities to remain distinguishable longer before converging.

## Preseason Pricing

**Prices are sourced from the official F1 Fantasy game's opening-day prices for the corresponding season.** The internal process is documented in `../reference/preseason-pricing-process.md`.

### Rationale

Attempts were made to create our own formula and/or use editorial changes, but it took more effort than it's likely worth at this point. It's unknown how F1 determines their starting prices, but even if they have a formula for determing the price it's not clear what that could look like. Starting prices don't seem to have a direct corelation to previous history, but may include that as well as pre-season findings and expectations/predictions. The in-season movements shouldn't make as much of a diference once the prices are established, but that will be something to monitor moving forward.

### Composition intent validation

After importing official prices each season, verify that the composition intent from `format.md` holds against the current season's prices. If a future season's official prices break this constraint, manual adjustments may be needed.

### Floor enforcement

Any imported price below $4.5M is set to the floor.

---

## In-Season Pricing

**PPM direction-based model.** Published and deterministic — any player can verify any price change against the formula and official FIA results. The one exception is mid-season team changes, where the game operator sets the new price (see Mid-Season Events).

### How it works

After each race, every entity's Points Per Million (PPM) is calculated: the race's fantasy points divided by the entity's current price. The rolling average PPM over the last 3 races determines which performance band the entity falls into, and the band determines whether the price rises, falls, and by how much.

### Neutral Point

**1.0 PPM for both drivers and constructors.** An entity scoring 1 point per million of price per race is at fair value — price unchanged. Above 1.0 = underpriced (price rises). Below 1.0 = overpriced (price falls).

Constructors structurally score higher PPM (~2x) because they aggregate two drivers' points, but with a fixed budget cap the resulting constructor price inflation doesn't create systemic problems — relative price signal is preserved.

### Performance Bands and Step Sizes

PPM is classified into four bands around the neutral point (band width ±0.80). Price movement per race depends on the band and the entity's current price tier.

**Price tiers:** A-Tier (≥$22M), B-Tier (<$22M).

| AvgPPM       | Band     | A-Tier (≥$22M) | B-Tier (<$22M) |
| ------------ | -------- | -------------- | -------------- |
| > 1.80       | Great    | +$0.3M         | +$0.6M         |
| > 1.0–1.80   | Good     | +$0.1M         | +$0.2M         |
| = 1.0        | Neutral  | no change      | no change      |
| ≥ 0.20–< 1.0 | Poor     | −$0.1M         | −$0.2M         |
| < 0.20       | Terrible | −$0.3M         | −$0.6M         |

- **A-tier entities move at half the rate of B-tier.** Elite assets serve as stable roster foundations; cheaper assets provide more volatile price action for active management.
- **Inner steps (Good/Poor) are one-third of outer steps (Great/Terrible).** Entities near fair value drift slowly; entities far from fair value correct faster.
- **Step sizes are fixed dollars, not percentages.** This avoids compounding — percentage-based movement produces catastrophic drops over consecutive negative rounds.

### Rolling Window

**3-race equally-weighted rolling average.** The average of the last 3 races' PPMs determines the band classification.

**Seeding:** 2 dummy races at neutral PPM (1.0) are prepended before R1. This fills the window from the start, preventing a single opening-race outlier from triggering outsized price movement. The dummy races rotate out by R3.

### PPM Floor at Zero

**Race PPM is floored at 0.** Negative fantasy scores (e.g., a DNF at $4.5M producing PPM of −2.22) produce a PPM of 0 for that race rather than the actual negative value. This prevents extreme negatives from poisoning the rolling window and creating a one-way floor trap where a single bad race locks a cheap entity into sustained Terrible-band classification.

The PPM floor means the worst single-race outcome contributes 0 to the average, not a large negative drag. An entity that DNFs one race and performs well the next two can escape the Terrible band — without the floor, the extreme negative would dominate the 3-race window for multiple rounds.

### Price Floor Enforcement

If a price adjustment would take an entity below $4.5M, the price is set to $4.5M. Entities at the floor remain there until their rolling average PPM reaches the Good band (>1.0), triggering a price increase.

---

## Mid-Season Events

### Driver replacements

When a driver is replaced mid-season, the incoming driver inherits the outgoing driver's current price and starts with a fresh PPM window (2 dummy races at neutral). The outgoing driver's price is frozen at their last active value.

### Team changes

When a driver changes teams mid-season, their price is reset by the game operator (informed by the official F1 Fantasy game's handling of the same event, if available). The driver starts with a fresh PPM window at the new team. This is the one case where pricing is editorial rather than formula-driven — no formula can reliably predict performance at a new team, so the operator sets a price that reflects the best available context. The new price and its rationale are published when the change takes effect.

---

## Transfer Mechanic

Transfers interact directly with pricing — they are the mechanism through which players act on price signals. Transfer allowance, banking, penalties, and deadlines are defined in `rules.md`.

---

## Known Limitations and Accepted Trade-offs

### Tier crossings are rare

The A-tier half-rate movement combined with narrow step sizes means entities rarely cross the $22M boundary during a season. In the 2025 validation, only 1 crossing occurred (HAM at R23). The tier boundary functions as a fixed volatility partition, not a dynamic reclassification.

### Constructor pricing runs hot

Constructors aggregate two drivers' scores but use the same neutral point (1.0 PPM). This means constructors structurally trend toward Good/Great bands and appreciate more than drivers. In the 2025 validation, 8 of 10 constructors appreciated. With a fixed budget cap (no uplift), constructor inflation doesn't break composition constraints — but it's worth monitoring across future seasons.

### 3-race window and outlier sensitivity

A single race has 33% weight in the 3-race window. The PPM floor at zero prevents extreme negative outliers (DNFs) from dominating the average, but positive outliers receive full weight and can trigger a band upgrade from a single strong result.
