# Own Rules

This folder contains the design work for defining our own game rules for the 2026 season. SportsDeck — the platform we originally planned to mirror — is not running their Grand Prix game in 2026, so we're designing format, scoring, and pricing from scratch.

## Files

### `design-framework.md`
The methodology for approaching the three interdependent systems (format, scoring, pricing). Explains why format is anchored first, how to model scoring against historical data, and how pricing is calibrated last. Read this if you're unsure how to sequence decisions.

### `design-goals.md`
The rubric. Defines what the player experience should feel like — audience, skill ceiling, volatility, DNF philosophy, engagement model, etc. Every format, scoring, and pricing decision should be evaluated against this. If a choice conflicts with a goal here, either the choice is wrong or the goal needs to be revisited.

### `format.md`
Where the team format decision lives once made. Covers how many driver/constructor slots, what constraints apply, and what role constructors play in the game. This is decided first because scoring and pricing both depend on it.

### `scoring.md`
Where the scoring rules live once defined. Covers what actions earn points, point values, constructor vs. driver scoring, and bonus/penalty events. Decided second, after format, using simulation against historical data.

### `pricing.md`
Where the pricing approach lives once defined. Covers budget cap, initial driver/constructor prices, and the price change mechanism. Calibrated last, against simulated scoring data, to ensure trade-offs are meaningful.

## Process

```
design-goals.md → format.md → scoring.md → pricing.md
```

See `design-framework.md` for the full methodology. Competitor research that informed this work lives in `../competitors/` and `../competitor-analysis.md`.
