"""
pricing.py — Pure pricing logic for the F1 Fantasy simulation.

No I/O, no FastF1 imports. All functions are stateless and easily unit-testable.

Chosen approach: Power Curve (shape=1.0)
Selected via bakeoff comparing 4 approaches against 2024 season data.
At shape=1.0 the formula is equivalent to linear normalization; the shape
parameter exists so the curve can be widened or compressed between seasons
without changing the formula structure.
"""

# ── Price bounds ──────────────────────────────────────────────────────────

DRIVER_FLOOR = 6_000_000        # $6M
CONSTRUCTOR_FLOOR = 6_000_000   # $6M

# ── Power curve parameters (from bakeoff, best params for ~130% tightness) ──

DRIVER_CEILING = 19_000_000     # $19M
CONSTRUCTOR_CEILING = 25_000_000  # $25M
SHAPE = 1.0                     # exponent; >1 top-heavy, <1 compressed

# Reference maxima for normalisation — 2024 best per-race averages.
# Used consistently for both preseason pricing and in-season target computation.
DRIVER_REF_MAX = 29.29    # VER: 703 pts / 24 races
CONSTRUCTOR_REF_MAX = 45.25  # McLaren: 1086 pts / 24 races (incl. qualifying)

# ── Budget ────────────────────────────────────────────────────────────────

BUDGET_CAP = 100_000_000   # $100M (produces ~146% tightness with current params)

# ── Team composition ──────────────────────────────────────────────────────

TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3

# ── Eligibility & rolling window ─────────────────────────────────────────

MIN_RACES_ELIGIBLE = 10   # drivers with fewer races in previous season → floor price
ROLLING_WINDOW = 3        # number of races used for in-season rolling average
DUMMY_SEED_COUNT = ROLLING_WINDOW - 1  # dummy preseason entries seeded into window

# ── In-season adjustment cap ──────────────────────────────────────────────

PRICE_CHANGE_CAP_FRACTION = 0.10  # max ±10% of current price per price update

# ── Internal helpers ──────────────────────────────────────────────────────


def _round_100k(x: float) -> int:
    """Round to nearest $100,000."""
    return round(x / 100_000) * 100_000


def _floor_for(entity_type: str) -> int:
    return DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR


def _ceiling_for(entity_type: str) -> int:
    return DRIVER_CEILING if entity_type == "driver" else CONSTRUCTOR_CEILING


def _ref_max_for(entity_type: str) -> float:
    return DRIVER_REF_MAX if entity_type == "driver" else CONSTRUCTOR_REF_MAX


def _normalise(per_race_avg: float, entity_type: str) -> float:
    """Clamp per_race_avg / REF_MAX to [0, 1]."""
    return max(0.0, min(1.0, per_race_avg / _ref_max_for(entity_type)))


def _power_curve(normalised: float, entity_type: str) -> int:
    floor = _floor_for(entity_type)
    ceiling = _ceiling_for(entity_type)
    return max(floor, _round_100k(floor + (ceiling - floor) * normalised ** SHAPE))


# ── Preseason pricing ─────────────────────────────────────────────────────


def compute_preseason_price(per_race_avg: float | None, entity_type: str) -> int:
    """
    Compute an entity's preseason price from its previous-season per-race average.

    Formula:
        normalised = clamp(per_race_avg / REF_MAX, 0, 1)
        price = max(FLOOR, round_100K(FLOOR + (CEILING - FLOOR) × normalised^SHAPE))

    Args:
        per_race_avg: Previous season pts-per-race. Pass None for rookies or
                      drivers with fewer than MIN_RACES_ELIGIBLE races → floor price.
        entity_type: "driver" or "constructor"

    Returns:
        Price in whole dollars, rounded to the nearest $100K, ≥ FLOOR.
    """
    if per_race_avg is None:
        return _floor_for(entity_type)
    return _power_curve(_normalise(per_race_avg, entity_type), entity_type)


# ── Team-context blend (for preseason pricing) ────────────────────────────

TEAM_CONTEXT_ALPHA = 0.5  # team changers: α × individual + (1-α) × new team avg


def compute_context_preseason_price(
    individual_avg: float | None,
    team_per_driver_avg: float | None,
    changed_team: bool,
    entity_type: str,
    alpha: float = TEAM_CONTEXT_ALPHA,
) -> int:
    """
    Compute preseason price with constructor-context adjustment.

    - No prior data (rookie / absent from prior season): price at new team's
      per-driver avg rather than the floor.
    - Team changer: blend α × individual + (1-α) × new team per-driver avg.
    - Same-team driver: equivalent to compute_preseason_price(individual_avg).

    Args:
        individual_avg:      Previous season per-race avg. None → rookie/absent.
        team_per_driver_avg: New team's per-driver per-race avg (constructor avg / 2).
                             None → falls back to floor price.
        changed_team:        True if the driver moved to a different constructor.
        entity_type:         "driver" or "constructor".
        alpha:               Blend weight for team changers (0 = pure team, 1 = pure individual).

    Returns:
        Price in whole dollars, rounded to $100K, ≥ FLOOR.
    """
    if individual_avg is None:
        # Rookie or absent — price at new team's per-driver avg
        adj_avg = max(0.0, team_per_driver_avg) if team_per_driver_avg is not None else None
    elif changed_team and team_per_driver_avg is not None:
        # Blend individual history with new team context
        adj_avg = max(0.0, alpha * individual_avg + (1.0 - alpha) * team_per_driver_avg)
    else:
        adj_avg = individual_avg
    return compute_preseason_price(adj_avg, entity_type)


def compute_all_preseason_prices(
    season_totals: dict[str, int],
    races_entered: dict[str, int],
    entity_type: str,
) -> dict[str, int]:
    """
    Batch-compute preseason prices from a season's totals.

    Args:
        season_totals: {entity_name: total_season_points}
        races_entered: {entity_name: races_participated}
                       For constructors (all races), pass {name: TOTAL_RACES}.
        entity_type: "driver" or "constructor"

    Returns:
        {entity_name: price_in_dollars}
    """
    prices: dict[str, int] = {}
    for entity, total in season_totals.items():
        races = races_entered.get(entity, 0)
        per_race_avg = total / races if races >= MIN_RACES_ELIGIBLE else None
        prices[entity] = compute_preseason_price(per_race_avg, entity_type)
    return prices


# ── In-season rolling average ─────────────────────────────────────────────


def compute_rolling_avg(scores: list[int | float], window: int = ROLLING_WINDOW) -> float | None:
    """
    Rolling average of the last `window` scores.

    Returns None if fewer than `window` scores are available — callers should
    treat None as "insufficient data" and make no price change.
    """
    if len(scores) < window:
        return None
    return sum(scores[-window:]) / window


# ── In-season price adjustment ────────────────────────────────────────────


def compute_price_change(
    current_price: int,
    rolling_avg: float | None,
    entity_type: str,
) -> int:
    """
    Compute the in-season price delta after a race.

    The delta moves current_price toward a target derived from the rolling
    average, bounded by ±(PRICE_CHANGE_CAP_FRACTION × current_price).

    No frozen period — use dummy-race seeding (DUMMY_SEED_COUNT entries equal
    to the entity's preseason per-race avg) so the rolling window is always
    full and corrections begin from round 1 with natural dampening.

    Args:
        current_price: Entity's price before this update, in dollars.
        rolling_avg:   Rolling average from compute_rolling_avg(); None → no change.
        entity_type:   "driver" or "constructor"

    Returns:
        Price delta in dollars (may be 0, positive, or negative).
        Always a multiple of $100K.
    """
    if rolling_avg is None:
        return 0

    target = _power_curve(_normalise(rolling_avg, entity_type), entity_type)
    raw_delta = target - current_price

    # Cap magnitude at PRICE_CHANGE_CAP_FRACTION of current price
    cap = max(100_000, _round_100k(current_price * PRICE_CHANGE_CAP_FRACTION))
    return max(-cap, min(cap, raw_delta))


def apply_price_change(current_price: int, change: int, entity_type: str) -> int:
    """
    Apply a price delta, clamping the result to the entity's floor.

    Args:
        current_price: Current price in dollars.
        change:        Delta from compute_price_change().
        entity_type:   "driver" or "constructor"

    Returns:
        New price in dollars, rounded to $100K, ≥ FLOOR.
    """
    floor = _floor_for(entity_type)
    return max(floor, _round_100k(current_price + change))


# ── Dream team cost ───────────────────────────────────────────────────────


def compute_dream_team_cost(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    driver_scores: dict[str, int],
    constructor_scores: dict[str, int],
) -> int:
    """
    Cost of the top TEAM_DRIVERS drivers + top TEAM_CONSTRUCTORS constructors
    as ranked by their season scores.

    Used to validate P1: dream team should cost 125–140% of BUDGET_CAP.

    Args:
        driver_prices:      {driver_name: price}
        constructor_prices: {constructor_name: price}
        driver_scores:      {driver_name: season_total} — used for ranking
        constructor_scores: {constructor_name: season_total} — used for ranking

    Returns:
        Total cost in dollars. Missing price entries fall back to floor price.
    """
    top_drivers = sorted(driver_scores, key=lambda d: -driver_scores[d])[:TEAM_DRIVERS]
    top_constructors = sorted(constructor_scores, key=lambda c: -constructor_scores[c])[:TEAM_CONSTRUCTORS]
    return (
        sum(driver_prices.get(d, DRIVER_FLOOR) for d in top_drivers)
        + sum(constructor_prices.get(c, CONSTRUCTOR_FLOOR) for c in top_constructors)
    )
