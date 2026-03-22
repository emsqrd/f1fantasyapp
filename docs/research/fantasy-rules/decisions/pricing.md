# Pricing

How entity prices are set before the season and how they change during it.

## Budget Cap

**$100M.** Every team operates under the same budget cap.

## Price Floor

**$4.5M.** The minimum price any entity can hold. The floor is a safety net, not a tier — only 2–3 entities should land there in a typical season. Floor compression among those entities is accepted by design.

## Preseason Pricing

**Prices are set before each season using a formula baseline with editorial adjustments.** The process is not published to players. See `../reference/preseason-pricing-process.md` for the internal process.

## In-Season Pricing

**PPM direction-based model.** Published and deterministic — any player can verify any price change against the formula and official FIA results.

### Neutral Point

**1.0 PPM for both drivers and constructors.** An entity scoring 1 point per million of price per race is at fair value. Above 1.0 = underpriced (price rises). Below 1.0 = overpriced (price falls).

### Performance Bands and Step Sizes

PPM is classified into four bands around the neutral point (±0.80 width). Price movement per race depends on the band and the entity's current price tier.

**Price tiers:** A-Tier (≥$22M), B-Tier (<$22M).

| AvgPPM   | Performance | A-Tier (≥$22M) | B-Tier (<$22M) |
|----------|-------------|----------------|----------------|
| > 1.80   | Great       | +$0.3M         | +$0.6M         |
| 1.0–1.80 | Good        | +$0.1M         | +$0.2M         |
| 0.20–1.0 | Poor        | −$0.1M         | −$0.2M         |
| < 0.20   | Terrible    | −$0.3M         | −$0.6M         |

A-tier entities move at half the rate of B-tier. Inner steps (Good/Poor) are one-third of outer steps (Great/Terrible). This creates stable elite assets as a roster foundation while cheaper assets provide more volatile price action for active management.

### Rolling Window

**3-race equally-weighted rolling average.** PPM is computed from each race's points divided by the entity's current price. The average of the last 3 races' PPMs determines the band classification.

**Seeding:** 2 dummy races at neutral PPM (1.0) are prepended before R1. This fills the window from the start, preventing a single opening-race outlier from triggering outsized price movement. The dummy races rotate out of the window by R3.
