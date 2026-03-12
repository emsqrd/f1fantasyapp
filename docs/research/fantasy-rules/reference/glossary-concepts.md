# Glossary: Concepts

Higher-level ideas and design patterns that appear repeatedly across pricing, format, and scoring decisions. Understanding these concepts is more important than memorizing their names.

---

**arbitrage** — exploiting a known mispricing by acquiring an underpriced asset before the market corrects. In a performance-driven game, arbitrage is the core transfer skill: recognizing that a driver is underpriced before their PPM forces a price rise. Healthy amounts of arbitrage opportunity make the metagame engaging.

**catch-up mechanic** — a system feature that helps trailing players close the gap on leaders. Examples: wildcards, bonus scoring events, or accelerated price rises for cheap assets. Too little catch-up = a runaway leader problem; too much = outcomes feel random.

**ceiling pinning** — when a top-performing asset hits the price ceiling and stays there regardless of continued strong performance. The PPM signal disappears (can't rise further), but the asset remains dominant. Distorts pricing by removing the mechanism that would otherwise keep making it expensive to hold.

**constructor-context pricing** — setting neutral points or prices for drivers relative to their constructor's overall budget and scoring contribution, rather than treating all drivers identically. Accounts for the fact that a $5M driver on a top team scores very differently than a $5M driver on a backmarker team.

**depth vs. complexity** — depth is the richness of meaningful decisions available to players; complexity is the cognitive overhead required to understand the system. Good game design maximizes depth (many genuine choices with different trade-offs) while minimizing unnecessary complexity (rules that don't produce interesting decisions). A pricing formula can be deep without being complex.

**direction-based pricing** — a model where prices move based on whether PPM is above or below the neutral point, not toward a fixed target price. The key property: there is no "correct" price an asset is converging toward, only a continuous signal of over- or underperformance. This is the approach committed for this app.

**dominant strategy** — a strategy that is optimal regardless of what other players do. Dominant strategies reduce the decision space to a single correct answer and should generally be designed out. Example of a bad outcome: a dominant strategy of "always use your wildcard at race 3" that every player discovers and executes identically.

**dummy seeding** — creating synthetic historical race data for the first 1-2 races of a season to bootstrap the rolling window. Without it, a single outlier in Race 1 carries disproportionate weight. The official F1 Fantasy game uses dummy races where each asset's synthetic score equals its starting price, producing an initial PPM of 1.0.

**feedback loop (negative)** — a self-correcting loop where deviation from equilibrium generates forces that restore it. Example: strong performance → price rises → PPM drops (same points, higher price) → price rise slows. The PPM mechanism is fundamentally a negative feedback loop. Stabilizing by design.

**feedback loop (positive)** — a loop where success enables more success. Example: owning rising assets generates budget, which enables acquiring more rising assets. Positive feedback loops can compound and destabilize a game economy if unchecked. Transfer rules and penalties are friction against this.

**floor compression** — the tendency for cheap assets to cluster at the price floor, reducing meaningful price differentiation at the bottom of the pool. Happens when step sizes are large relative to the floor or when poor performers have nowhere left to fall. Makes budget-building decisions less interesting.

**friction** — intentional barriers to action: transfer penalties, deadlines, per-race limits. Friction prevents degenerate strategies (e.g., mass-swapping the entire roster every race) and forces players to commit to decisions. The right amount of friction creates tension; too much creates frustration.

**inflation/deflation** — a systematic drift in the overall price level across the asset pool. If strong performers outpace weak performers in price movement, overall prices rise (inflation), making the budget cap effectively tighter for new teams. A well-calibrated neutral point prevents systemic inflation.

**liquidity** — how easily and cheaply assets can be exchanged. Affected by transfer rules, deadlines, and penalties. High liquidity (many free transfers, low penalties) means mispricings correct quickly through player action. Low liquidity means mispricings persist longer, but the transfer decision is more meaningful.

**lock-in effect** — the psychological and mechanical pressure to hold an asset once you own it, even when swapping would be optimal. In FPL, selling a risen player means forfeiting the profit above the buy price. In our model, the transfer penalty is the primary lock-in mechanism. Affects how freely players act on pricing signals.

**metagame** — the strategic layer around the game itself. In fantasy sports, includes transfer timing, price speculation, captain selection, and wildcard strategy. A well-designed metagame rewards F1 knowledge and genuine insight, not just gaming the pricing mechanism. PPM produces a lighter metagame than FPL's speculation-heavy model.

**opportunity cost** — the value of the next-best option foregone. Holding an underperforming driver has the opportunity cost of the better driver you could own instead. Transfer penalties make opportunity cost explicit: is the points gain from swapping worth the penalty?

**player agency** — the degree to which players feel their decisions matter and that outcomes are within their control. High agency drives engagement even when outcomes are uncertain. A game where the optimal team is obvious from week 1 has low agency; a game with meaningful transfer decisions has high agency.

**power curves** — a mathematical distribution (y = a · x^b) used to generate initial prices across a ranked asset pool. Produces a steep drop-off from top to bottom assets that mirrors real F1 performance spreads. The shape parameter controls how steep the curve is; REF_MAX anchors the top.

**price compression** — the tendency for prices to cluster together over time, reducing the meaningful spread between assets. Makes team differentiation harder and reduces the strategic value of budget management. Can result from floor compression at the bottom or ceiling pinning at the top.

**price discovery** — the process by which a pricing system converges on the "true" fair value for an asset through repeated adjustments. The PPM mechanism is a price discovery mechanism: it repeatedly adjusts prices toward fair value based on performance signals. Speed of discovery is controlled by step size and band width.

**self-limiting feedback loop** — a specific negative feedback loop where the pricing mechanism naturally caps its own corrections. Strong performance → price rises → less budget to acquire the asset → ownership concentration decreases → if demand-driven, price stabilizes. In PPM terms: strong performance → price rises → PPM falls → price rise slows. The system prevents runaway pricing.

**skill expression** — the degree to which player decisions meaningfully affect outcomes. High skill expression means a player who understands F1 better will consistently outperform one who doesn't. Luck (DNFs, safety cars, weather) introduces variance, but good skill expression ensures skill dominates over a full season.

**speculation vs. fundamental value** — speculation is acquiring an asset based on expected future price movement; fundamental value is acquiring based on expected points output. FPL rewards speculation (buy early, sell before the price corrects). PPM-based pricing rewards fundamental value (hold good assets, not just rising ones). Both are valid metagames; the choice is a design decision.

**target-based pricing** — a model where each asset has a computed "fair value" target price and the mechanism moves prices toward it. The problem: the target must be recalculated continuously, and if targets are miscalibrated they can cause ceiling pinning or compounding volatility. Abandoned in favor of direction-based pricing.

**tiered pricing** — dividing assets into price bands (tiers) that have different step sizes. The official F1 Fantasy game uses two tiers: assets above $18.5M move by smaller amounts; below $18.5M move by larger amounts. This helps cheap underpriced assets catch up quickly and prevents cheap assets from being stuck in mispricing.
