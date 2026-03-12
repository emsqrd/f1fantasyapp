# Glossary: Keywords

Precise technical terms used in game engine design and analysis. When these words appear in decisions, research, or simulations, they mean exactly what is written here.

---

**α (alpha / blend weight)** — a parameter between 0 and 1 that controls the weighting between two inputs in a linear blend. Formula: `result = α × A + (1 - α) × B`. At α=1.0, the result is entirely A. At α=0.0, it is entirely B. At α=0.5, both contribute equally. In our model, α is used in constructor-context preseason pricing to blend a driver's individual prior-season average with their new team's per-driver average; α=0.5 was found optimal against 2025 data.

**band width** — the range around the neutral point within which no price movement occurs. An asset with PPM inside the band is considered fairly priced. Wider band = fewer, less frequent changes.

**budget cap** — the maximum total price of a team's roster. The hard constraint all team-building decisions operate within. Currently $100M.

**budget uplift** — an increase to a team's budget cap that occurs when an owned asset rises in price, preventing the roster from becoming illegal. The official F1 Fantasy game implements this; we have not yet decided whether to adopt it.

**ceiling** — the maximum price an asset can reach. A hard upper bound on price movement. When assets hit the ceiling and stay there, it causes ceiling pinning (see concepts glossary).

**correction speed** — how quickly prices converge toward fair value after a mispricing. Determined jointly by step size, band width, and update frequency. Faster correction = more responsive market; slower = more stable.

**decay rate** — the rate at which older races lose influence in a weighted rolling average. A high decay rate makes older data effectively irrelevant; a low rate gives older data more weight. Related to recency weighting.

**drift %** — the percentage change in an asset's price from its starting price to its current price over a season. A useful season-end metric for how much prices moved in aggregate.

**floor** — the minimum price an asset can reach. A hard lower bound on price movement. Floors prevent cheap assets from becoming free, but can cause floor compression (see concepts glossary) if set too high.

**mean reversion** — the tendency for extreme PPM values (very high or very low) to return toward the average over time as outlier performances normalize. A key reason aggressive price swings often self-correct without intervention.

**mispricing** — when an asset's price does not reflect its actual performance value. The core problem dynamic pricing is designed to solve. An asset is overpriced if its PPM is consistently below neutral; underpriced if consistently above.

**neutral point** — the PPM value at which an asset's price is considered fairly priced. The boundary between "price should rise" and "price should fall." Drivers and constructors need separate neutral points.

**outlier** — a single result that is anomalously far from typical performance. Can distort rolling PPM if not smoothed. The dummy seeding mechanic (see concepts glossary) exists specifically to dampen early-season outliers.

**PPM (Points Per Million)** — points scored divided by current price. The core metric for evaluating whether an asset is over- or underpriced. PPM above neutral = underpriced; below neutral = overpriced.

**recency weighting** — assigning higher weight to more recent races in the rolling average so that recent form matters more than older results. Contrast with equal-weight rolling average.

**REF_MAX** — the reference maximum price used in power curve formulas to anchor the top of the price distribution. Sets the ceiling for the most expensive asset; all other prices are derived relative to it.

**rolling window** — the number of races whose scores are averaged to compute current PPM. Controls how far back performance history reaches. Short window = reactive; long window = stable.

**sample size** — the number of data points (races) feeding into a PPM calculation. Small sample sizes make estimates unreliable. The rolling window determines sample size; the dummy seeding bootstraps it at season start.

**shape parameter** — a tunable exponent in power curve formulas controlling how steeply prices fall from the most to least expensive assets. Higher value = steeper curve = greater spread between top and bottom prices.

**step size** — the dollar amount by which a price changes in a single update cycle. Can be uniform (all assets move the same amount) or tiered (cheaper assets move more). Inner and outer step sizes may differ.

**swing %** — the total price range (high minus low) over a season, expressed as a percentage of starting price. Measures how much an asset's price fluctuated. Distinct from drift (which only measures start-to-end).

**tightness ratio** — the ratio between the highest and lowest prices in the asset pool. A ratio of 5:1 means the most expensive asset costs five times the cheapest. Measures how compressed or spread the price distribution is.

**transaction cost** — the cost of making a transfer, expressed in penalty points. Affects how often players should rationally trade and therefore how quickly the market can correct mispricings.

**variance** — the statistical spread of outcomes around the mean. A high-variance driver scores very differently race to race. High variance makes PPM estimates less reliable over short windows and creates pricing uncertainty.

**volatility** — the tendency for a price to change frequently or by large amounts over time. Caused by high variance in underlying performance combined with a reactive pricing mechanism. Distinct from variance (which is about scores, not prices).
