"""
ppm_simulation.py — Direction-based (PPM) pricing model simulation.

Simulates the PPM-based pricing mechanism against 2025 season data to answer
the five open questions from pricing-model-direction-based.md:

  Q1: What neutral point works for our scoring model?
  Q2: What step sizes produce acceptable correction speed?
  Q3: Does a single tier boundary work, or do we need a different split?
  Q4: Equal vs recency-weighted window?
  Q5: What happens to preseason mispricing under PPM correction?

Usage:
    cd docs/research/fantasy-rules/own-rules/simulation
    source .venv/bin/activate
    python ppm_simulation.py
"""

import csv
import re
from collections import defaultdict
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
DATA_2025_DIR = OUTPUT_DIR / "2025"
PRICING_DIR = OUTPUT_DIR / "pricing"
PPM_DIR = OUTPUT_DIR / "ppm"

# ── Constants from existing model ────────────────────────────────────────

DRIVER_FLOOR = 6_000_000
CONSTRUCTOR_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_CEILING = 25_000_000
BUDGET_CAP = 100_000_000
TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
TOTAL_ROUNDS = 24


# ── Data loading ─────────────────────────────────────────────────────────


def load_per_round_scores(path: Path, entity_col: str) -> dict[int, dict[str, int]]:
    """Returns {round: {entity: total_pts}}."""
    data: dict[int, dict[str, int]] = defaultdict(dict)
    with open(path) as f:
        for row in csv.DictReader(f):
            data[int(row["round"])][row[entity_col]] = int(row["total_pts"])
    return dict(data)


def load_preseason_prices(path: Path) -> tuple[dict[str, int], dict[str, int]]:
    """Load preseason prices from the existing pricing simulation output."""
    d_prices: dict[str, int] = {}
    c_prices: dict[str, int] = {}
    with open(path) as f:
        for row in csv.DictReader(f):
            price = int(row["preseason_price"])
            if row["type"] == "driver":
                d_prices[row["entity"]] = price
            else:
                c_prices[row["entity"]] = price
    return d_prices, c_prices


def load_season_totals(path: Path, entity_col: str) -> dict[str, int]:
    with open(path) as f:
        return {row[entity_col]: int(row["season_total"]) for row in csv.DictReader(f)}


# ── PPM model ────────────────────────────────────────────────────────────


def _round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def compute_ppm(points: float, price: int) -> float:
    """Points per million dollars."""
    return points / (price / 1_000_000) if price > 0 else 0.0


def compute_rolling_ppm(
    score_history: list[float],
    price_history: list[int],
    window: int,
    weights: list[float] | None = None,
) -> float | None:
    """
    Compute rolling PPM over the last `window` races.

    Each race's PPM is computed individually (race_pts / price_at_that_race_in_M),
    then averaged. This prevents a single high-scoring race from being diluted
    by an already-risen price.

    Args:
        score_history: Per-race scores (at least `window` entries).
        price_history: Price in effect for each corresponding race.
        window:        Number of races in the rolling window.
        weights:       Optional weights for each position in the window
                       (oldest to newest). None = equal weight.
    Returns:
        Weighted average PPM, or None if insufficient data.
    """
    if len(score_history) < window or len(price_history) < window:
        return None

    recent_scores = score_history[-window:]
    recent_prices = price_history[-window:]

    ppms = [compute_ppm(s, p) for s, p in zip(recent_scores, recent_prices)]

    if weights is None:
        return sum(ppms) / len(ppms)
    else:
        return sum(w * p for w, p in zip(weights, ppms)) / sum(weights)


def classify_ppm(
    ppm: float,
    thresholds: tuple[float, float, float],
) -> str:
    """
    Classify PPM into performance bands.

    thresholds = (terrible_upper, poor_upper_aka_neutral, good_upper)
    E.g. (0.6, 0.9, 1.2) means:
      < 0.6 → terrible
      0.6–0.9 → poor
      0.9–1.2 → good
      > 1.2 → great
    """
    if ppm < thresholds[0]:
        return "terrible"
    elif ppm < thresholds[1]:
        return "poor"
    elif ppm < thresholds[2]:
        return "good"
    else:
        return "great"


def get_step(
    band: str,
    price: int,
    tier_boundary: int,
    steps_a: dict[str, int],
    steps_b: dict[str, int],
) -> int:
    """
    Get the price change step based on performance band and price tier.

    A-Tier (price >= tier_boundary): smaller steps.
    B-Tier (price < tier_boundary): larger steps.
    """
    steps = steps_a if price >= tier_boundary else steps_b
    return steps[band]


def simulate_ppm_season(
    preseason_d_prices: dict[str, int],
    preseason_c_prices: dict[str, int],
    per_round_driver: dict[int, dict[str, int]],
    per_round_constructor: dict[int, dict[str, int]],
    *,
    window: int = 3,
    weights: list[float] | None = None,
    d_thresholds: tuple[float, float, float] = (0.6, 0.9, 1.2),
    c_thresholds: tuple[float, float, float] = (0.6, 0.9, 1.2),
    d_tier_boundary: int = 13_000_000,
    c_tier_boundary: int = 19_000_000,
    d_steps_a: dict[str, int] | None = None,
    d_steps_b: dict[str, int] | None = None,
    c_steps_a: dict[str, int] | None = None,
    c_steps_b: dict[str, int] | None = None,
    d_floor: int = DRIVER_FLOOR,
    c_floor: int = CONSTRUCTOR_FLOOR,
    d_ceiling: int = DRIVER_CEILING,
    c_ceiling: int = CONSTRUCTOR_CEILING,
) -> tuple[
    dict[str, dict[int, int]],   # d_price_history: {driver: {round: price}}
    dict[str, dict[int, int]],   # c_price_history: {constructor: {round: price}}
    dict[str, list[float]],      # d_ppm_history: {driver: [ppm_per_round]}
    dict[str, list[float]],      # c_ppm_history: {constructor: [ppm_per_round]}
    dict[str, list[str]],        # d_band_history: {driver: [band_per_round]}
    dict[str, list[str]],        # c_band_history: {constructor: [band_per_round]}
]:
    """
    Run a full season simulation with PPM-based direction pricing.

    Prices update AFTER each race: race N's score is observed, PPM is computed,
    and the new price takes effect for race N+1.
    """
    # Default step sizes (in dollars)
    if d_steps_a is None:
        d_steps_a = {"great": 300_000, "good": 100_000, "poor": -100_000, "terrible": -300_000}
    if d_steps_b is None:
        d_steps_b = {"great": 600_000, "good": 200_000, "poor": -200_000, "terrible": -600_000}
    if c_steps_a is None:
        c_steps_a = {"great": 300_000, "good": 100_000, "poor": -100_000, "terrible": -300_000}
    if c_steps_b is None:
        c_steps_b = {"great": 600_000, "good": 200_000, "poor": -200_000, "terrible": -600_000}

    # Identify active entities from the data
    active_drivers: set[str] = set()
    active_constructors: set[str] = set()
    for r in per_round_driver.values():
        active_drivers.update(r.keys())
    for r in per_round_constructor.values():
        active_constructors.update(r.keys())

    # Initialize prices
    d_prices = {d: preseason_d_prices.get(d, d_floor) for d in active_drivers}
    c_prices = {c: preseason_c_prices.get(c, c_floor) for c in active_constructors}

    # Score and price histories for rolling PPM computation
    d_score_hist: dict[str, list[float]] = {d: [] for d in active_drivers}
    c_score_hist: dict[str, list[float]] = {c: [] for c in active_constructors}
    d_price_at_race: dict[str, list[int]] = {d: [] for d in active_drivers}
    c_price_at_race: dict[str, list[int]] = {c: [] for c in active_constructors}

    # Output histories
    d_price_history: dict[str, dict[int, int]] = {d: {} for d in active_drivers}
    c_price_history: dict[str, dict[int, int]] = {c: {} for c in active_constructors}
    d_ppm_history: dict[str, list[float]] = {d: [] for d in active_drivers}
    c_ppm_history: dict[str, list[float]] = {c: [] for c in active_constructors}
    d_band_history: dict[str, list[str]] = {d: [] for d in active_drivers}
    c_band_history: dict[str, list[str]] = {c: [] for c in active_constructors}

    for round_num in range(1, TOTAL_ROUNDS + 1):
        # Record prices in effect for this round
        for d in active_drivers:
            d_price_history[d][round_num] = d_prices[d]
        for c in active_constructors:
            c_price_history[c][round_num] = c_prices[c]

        # Record this round's scores and prices-at-race
        for d in active_drivers:
            score = per_round_driver.get(round_num, {}).get(d, 0)
            d_score_hist[d].append(float(score))
            d_price_at_race[d].append(d_prices[d])
        for c in active_constructors:
            score = per_round_constructor.get(round_num, {}).get(c, 0)
            c_score_hist[c].append(float(score))
            c_price_at_race[c].append(c_prices[c])

        # Compute PPM and update prices for next round
        for d in active_drivers:
            rolling_ppm = compute_rolling_ppm(
                d_score_hist[d], d_price_at_race[d], window, weights
            )
            if rolling_ppm is not None:
                band = classify_ppm(rolling_ppm, d_thresholds)
                step = get_step(band, d_prices[d], d_tier_boundary, d_steps_a, d_steps_b)
                new_price = _round_100k(d_prices[d] + step)
                d_prices[d] = max(d_floor, new_price)
                d_ppm_history[d].append(rolling_ppm)
                d_band_history[d].append(band)
            else:
                d_ppm_history[d].append(0.0)
                d_band_history[d].append("n/a")

        for c in active_constructors:
            rolling_ppm = compute_rolling_ppm(
                c_score_hist[c], c_price_at_race[c], window, weights
            )
            if rolling_ppm is not None:
                band = classify_ppm(rolling_ppm, c_thresholds)
                step = get_step(band, c_prices[c], c_tier_boundary, c_steps_a, c_steps_b)
                new_price = _round_100k(c_prices[c] + step)
                c_prices[c] = max(c_floor, new_price)
                c_ppm_history[c].append(rolling_ppm)
                c_band_history[c].append(band)
            else:
                c_ppm_history[c].append(0.0)
                c_band_history[c].append("n/a")

    return (
        d_price_history, c_price_history,
        d_ppm_history, c_ppm_history,
        d_band_history, c_band_history,
    )


# ── Analysis functions ───────────────────────────────────────────────────


def compute_actual_ppm_distribution(
    per_round_scores: dict[int, dict[str, int]],
    preseason_prices: dict[str, int],
    entity_type: str,
) -> dict[str, float]:
    """
    Compute the actual season-average PPM for each entity at their preseason price.
    This is the PPM that would apply if prices never changed — useful for calibrating
    the neutral point.
    """
    floor = DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR
    totals: dict[str, int] = defaultdict(int)
    counts: dict[str, int] = defaultdict(int)
    for round_data in per_round_scores.values():
        for entity, pts in round_data.items():
            totals[entity] += pts
            counts[entity] += 1

    result = {}
    for entity, total in totals.items():
        price = preseason_prices.get(entity, floor)
        avg_per_race = total / counts[entity] if counts[entity] > 0 else 0
        result[entity] = compute_ppm(avg_per_race, price)
    return result


def analyze_inflation_deflation(
    price_history: dict[str, dict[int, int]],
    preseason_prices: dict[str, int],
    entity_type: str,
) -> dict[str, dict]:
    """
    For each entity, compute:
    - Total price change (final - preseason)
    - Direction: inflated, deflated, or stable
    - Max price, min price
    """
    floor = DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR
    results = {}
    for entity, rounds in price_history.items():
        prices = [rounds[r] for r in sorted(rounds.keys())]
        preseason = preseason_prices.get(entity, floor)
        final = prices[-1] if prices else preseason
        results[entity] = {
            "preseason": preseason,
            "final": final,
            "change": final - preseason,
            "change_pct": (final - preseason) / preseason if preseason > 0 else 0,
            "max_price": max(prices) if prices else preseason,
            "min_price": min(prices) if prices else preseason,
            "direction": "inflated" if final > preseason else ("deflated" if final < preseason else "stable"),
        }
    return results


def count_band_distribution(band_history: dict[str, list[str]]) -> dict[str, int]:
    """Count total occurrences of each band across all entities."""
    counts: dict[str, int] = defaultdict(int)
    for bands in band_history.values():
        for b in bands:
            counts[b] += 1
    return dict(counts)


def analyze_correction_speed(
    price_history: dict[str, dict[int, int]],
    per_round_scores: dict[int, dict[str, int]],
    preseason_prices: dict[str, int],
    season_totals: dict[str, int],
    entity_type: str,
    known_mispriced: dict[str, str],  # {entity: "over" | "under"}
) -> dict[str, dict]:
    """
    For known mispriced entities (from the unified model's analysis),
    measure how quickly the PPM model corrects toward their fair value.

    Fair value proxy: entity's final-season-rank-implied price position.
    """
    results = {}
    for entity, direction in known_mispriced.items():
        if entity not in price_history:
            continue
        rounds = price_history[entity]
        prices = [rounds[r] for r in sorted(rounds.keys())]
        preseason = preseason_prices.get(entity, DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR)

        # Track when the correction becomes meaningful (>5% from preseason)
        first_5pct_round = None
        for i, p in enumerate(prices):
            if abs(p - preseason) / preseason >= 0.05:
                first_5pct_round = i + 1
                break

        results[entity] = {
            "preseason": preseason,
            "direction": direction,
            "prices": prices,
            "first_5pct_round": first_5pct_round,
            "final_price": prices[-1] if prices else preseason,
            "total_change": prices[-1] - preseason if prices else 0,
            "total_change_pct": (prices[-1] - preseason) / preseason if prices and preseason > 0 else 0,
        }
    return results


def compute_max_3race_swing(price_history: dict[str, dict[int, int]]) -> tuple[float, str]:
    """Largest price swing over any 3-race window. Returns (swing_fraction, entity_info)."""
    max_swing = 0.0
    max_info = ""
    for entity, rounds in price_history.items():
        sorted_rounds = sorted(rounds.keys())
        for i in range(len(sorted_rounds) - 2):
            p_start = rounds[sorted_rounds[i]]
            p_end = rounds[sorted_rounds[i + 2]]
            if p_start > 0:
                swing = abs(p_end - p_start) / p_start
                if swing > max_swing:
                    max_swing = swing
                    max_info = f"{entity} R{sorted_rounds[i]}–R{sorted_rounds[i + 2]}"
    return max_swing, max_info


def compute_max_prices(
    price_history: dict[str, dict[int, int]],
) -> dict[str, int]:
    """Return the max price reached by each entity over the season."""
    return {
        entity: max(rounds.values())
        for entity, rounds in price_history.items()
        if rounds
    }


def compute_round_changes(
    price_history: dict[str, dict[int, int]],
) -> list[float]:
    """Total absolute price change across all entities for each round transition."""
    all_entities = list(price_history.keys())
    if not all_entities:
        return []
    rounds = sorted(price_history[all_entities[0]].keys())
    changes = []
    for i in range(1, len(rounds)):
        total_change = sum(
            abs(price_history[e][rounds[i]] - price_history[e][rounds[i - 1]])
            for e in all_entities
        )
        changes.append(total_change)
    return changes


# ── Report generation ────────────────────────────────────────────────────


def generate_report(results: dict, path: Path) -> None:
    """Write comprehensive analysis report."""
    lines: list[str] = []
    lines.append("# PPM Direction-Based Pricing — Simulation Report\n")
    lines.append(f"**Data:** 2025 season ({TOTAL_ROUNDS} rounds)\n")

    # ── Q1: Neutral point ────────────────────────────────────────────────
    lines.append("---\n")
    lines.append("## Q1: Neutral Point Calibration\n")
    lines.append("### Actual PPM Distribution at Preseason Prices\n")
    lines.append("These are the season-average PPMs each entity would have if prices never changed.\n")
    lines.append("The neutral point should sit near the median to prevent systematic inflation/deflation.\n")

    for label, dist in [("Drivers", results["d_ppm_dist"]), ("Constructors", results["c_ppm_dist"])]:
        lines.append(f"\n**{label}:**\n")
        lines.append(f"{'Entity':<22} {'Avg PPM':>8}  {'Preseason Price':>15}")
        lines.append("-" * 50)
        for entity, ppm in sorted(dist.items(), key=lambda x: -x[1]):
            price = results["d_preseason" if label == "Drivers" else "c_preseason"].get(entity, 0)
            lines.append(f"{entity:<22} {ppm:>8.3f}  ${price/1e6:>13.1f}M")
        ppms = list(dist.values())
        if ppms:
            ppms_sorted = sorted(ppms)
            median = ppms_sorted[len(ppms_sorted) // 2]
            mean = sum(ppms) / len(ppms)
            lines.append(f"\n  Mean: {mean:.3f}   Median: {median:.3f}   Min: {min(ppms):.3f}   Max: {max(ppms):.3f}")

    # ── Q1 sweep results ─────────────────────────────────────────────────
    lines.append("\n### Neutral Point Sweep Results\n")
    lines.append("Testing different neutral points — measuring net inflation/deflation.\n")

    for label, sweep_key in [("Drivers", "d_neutral_sweep"), ("Constructors", "c_neutral_sweep")]:
        lines.append(f"\n**{label}:**\n")
        lines.append(f"{'Neutral':>8} {'Net change':>12} {'Inflated':>10} {'Deflated':>10} {'Stable':>8} {'Band dist':>40}")
        lines.append("-" * 95)
        for row in results[sweep_key]:
            lines.append(
                f"{row['neutral']:>8.2f} "
                f"${row['net_change']/1e6:>+10.1f}M "
                f"{row['inflated']:>10} "
                f"{row['deflated']:>10} "
                f"{row['stable']:>8} "
                f"G:{row['great']:>3} g:{row['good']:>3} p:{row['poor']:>3} T:{row['terrible']:>3}"
            )

    # ── Band Width Sweep ────────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## Band Width Sweep\n")
    lines.append("Testing wider band thresholds to address the 72% extreme-band concentration.\n")
    lines.append("Baseline steps: D outer=$0.40M, C outer=$0.60M (per-type best from prior analysis).\n")
    lines.append(f"Neutrals: D={results.get('best_d_n_orig', '?')}, C={results.get('best_c_n_orig', '?')} (from Q1).\n")

    lines.append(f"\n### Combined Distribution\n")
    lines.append(f"{'Width':>8} {'Great':>8} {'Good':>8} {'Poor':>8} {'Terrible':>10} "
                 f"{'Imbalance':>10} {'D net':>10} {'C net':>10} {'Swing':>8} {'Floor':>6}")
    lines.append("-" * 100)
    for row in results["band_width_sweep"]:
        lines.append(
            f"  ±{row['half_width']:.2f} "
            f"{row['great_pct']:>7.0%} "
            f"{row['good_pct']:>7.0%} "
            f"{row['poor_pct']:>7.0%} "
            f"{row['terrible_pct']:>9.0%} "
            f"{row['imbalance']:>9.4f} "
            f"${row['d_net_change']/1e6:>+8.1f}M "
            f"${row['c_net_change']/1e6:>+8.1f}M "
            f"{row['max_3r_swing']:>7.1%} "
            f"{row['d_floor_pinned']+row['c_floor_pinned']:>5}"
        )

    lines.append(f"\n### Driver Distribution\n")
    lines.append(f"{'Width':>8} {'Great':>8} {'Good':>8} {'Poor':>8} {'Terrible':>10}")
    lines.append("-" * 50)
    for row in results["band_width_sweep"]:
        lines.append(
            f"  ±{row['half_width']:.2f} "
            f"{row['d_great_pct']:>7.0%} "
            f"{row['d_good_pct']:>7.0%} "
            f"{row['d_poor_pct']:>7.0%} "
            f"{row['d_terrible_pct']:>9.0%}"
        )

    lines.append(f"\n### Constructor Distribution\n")
    lines.append(f"{'Width':>8} {'Great':>8} {'Good':>8} {'Poor':>8} {'Terrible':>10}")
    lines.append("-" * 50)
    for row in results["band_width_sweep"]:
        lines.append(
            f"  ±{row['half_width']:.2f} "
            f"{row['c_great_pct']:>7.0%} "
            f"{row['c_good_pct']:>7.0%} "
            f"{row['c_poor_pct']:>7.0%} "
            f"{row['c_terrible_pct']:>9.0%}"
        )

    best_bw_val = results.get("best_half_width", 0.30)
    lines.append(f"\n**Selected:** ±{best_bw_val:.2f} (lowest imbalance)\n")

    # ── Q2: Step sizes ───────────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## Q2: Uniform Step Magnitude Calibration\n")
    lines.append("Sweeping outer step magnitudes (great/terrible bands) with inner = outer/3.\n")
    lines.append("All entities use the same steps — no tiers. Pure magnitude test.\n")

    lines.append(f"{'Outer':>10} {'Inner':>8} {'Swing':>8} {'Avg Δ/r':>10} "
                 f"{'D max':>10} {'C max':>10} {'D net':>10} {'C net':>10} {'Band dist':>30}")
    lines.append("-" * 115)
    for row in results["step_sweep"]:
        lines.append(
            f"${row['outer']/1e6:>8.2f}M "
            f"${row['inner']/1e6:>6.2f}M "
            f"{row['max_3r_swing']:>7.1%} "
            f"${row['avg_round_change']/1e6:>8.1f}M "
            f"${row['d_max_price']/1e6:>8.1f}M "
            f"${row['c_max_price']/1e6:>8.1f}M "
            f"${row['d_net_change']/1e6:>+8.1f}M "
            f"${row['c_net_change']/1e6:>+8.1f}M "
            f"G:{row.get('great',0):>3} g:{row.get('good',0):>3} p:{row.get('poor',0):>3} T:{row.get('terrible',0):>3}"
        )

    # ── Q3: Tier boundary ────────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## Q3: Do Tiers Improve on the Best Uniform Step Size?\n")
    lines.append("Three approaches compared:\n")
    lines.append("- **Part A (Control):** Single uniform step for all entities.\n")
    lines.append("- **Part B (Per-type):** Separate uniform steps for drivers vs constructors — no price boundary.\n")
    lines.append("- **Part C (Tiered):** Price-based A/B boundary with different steps above/below.\n")

    lines.append("\n### Part A: Control — Uniform\n")
    for row in results["tier_sweep"]:
        if row["label"].startswith("Uniform"):
            lines.append(
                f"  {row['label']}: swing={row['max_3r_swing']:.1%}, "
                f"avg_Δ=${row['avg_round_change']/1e6:.1f}M, "
                f"d_net=${row['d_net_change']/1e6:+.1f}M, "
                f"c_net=${row['c_net_change']/1e6:+.1f}M"
            )

    lines.append("\n### Part B: Separate Uniform Per Type\n")
    lines.append(f"{'D outer':>10} {'C outer':>10} {'Swing':>8} {'Avg Δ/r':>10} {'D net':>10} {'C net':>10} {'D max':>10} {'C max':>10}")
    lines.append("-" * 90)
    for row in results.get("per_type_sweep", []):
        lines.append(
            f"${row['d_outer']/1e6:>8.2f}M "
            f"${row['c_outer']/1e6:>8.2f}M "
            f"{row['max_3r_swing']:>7.1%} "
            f"${row['avg_round_change']/1e6:>8.1f}M "
            f"${row['d_net_change']/1e6:>+8.1f}M "
            f"${row['c_net_change']/1e6:>+8.1f}M "
            f"${row['d_max_price']/1e6:>8.1f}M "
            f"${row['c_max_price']/1e6:>8.1f}M"
        )

    lines.append("\n### Part C: Tiered (price-based A/B boundary)\n")
    lines.append(f"{'Config':<55} {'Swing':>8} {'Avg Δ/r':>10} {'D net':>10} {'C net':>10} {'D max':>10} {'C max':>10}")
    lines.append("-" * 120)
    for row in results["tier_sweep"]:
        if row["label"].startswith("Tiered"):
            lines.append(
                f"{row['label']:<55} "
                f"{row['max_3r_swing']:>7.1%} "
                f"${row['avg_round_change']/1e6:>8.1f}M "
                f"${row['d_net_change']/1e6:>+8.1f}M "
                f"${row['c_net_change']/1e6:>+8.1f}M "
                f"${row['d_max_price']/1e6:>8.1f}M "
                f"${row['c_max_price']/1e6:>8.1f}M"
            )

    # ── Q1 recalibration ─────────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## Q1 Recalibration: Neutral Points at Q3 Winning Steps\n")
    lines.append("Re-sweeping neutral points using the Q3 best step configuration.\n")
    lines.append("If the optimal neutral shifts significantly, the Q3 drift result was partly an artefact of miscalibrated neutrals.\n")

    for label, recal_key, orig in [
        ("Drivers", "d_neutral_recal", results.get("best_d_n_orig", "?")),
        ("Constructors", "c_neutral_recal", results.get("best_c_n_orig", "?")),
    ]:
        lines.append(f"\n**{label}** (original neutral: {orig}):\n")
        lines.append(f"{'Neutral':>8} {'Net change':>12} {'Inflated':>10} {'Deflated':>10} {'Stable':>8} {'Band dist':>40}")
        lines.append("-" * 95)
        for row in results[recal_key]:
            lines.append(
                f"{row['neutral']:>8.2f} "
                f"${row['net_change']/1e6:>+10.1f}M "
                f"{row['inflated']:>10} "
                f"{row['deflated']:>10} "
                f"{row['stable']:>8} "
                f"G:{row['great']:>3} g:{row['good']:>3} p:{row['poor']:>3} T:{row['terrible']:>3}"
            )

    # ── Q4: Window weighting ─────────────────────────────────────────────
    lines.append("\n---\n")
    lines.append("## Q4: Equal vs Recency-Weighted Window\n")

    for row in results["window_sweep"]:
        lines.append(f"\n**{row['label']}** (weights: {row['weights_label']})\n")
        lines.append(f"  Max 3-race swing: {row['max_3r_swing']:.1%}")
        lines.append(f"  Avg round change: ${row['avg_round_change']/1e6:.1f}M")
        lines.append(f"  Max round change: ${row['max_round_change']/1e6:.1f}M")
        lines.append(f"  Band distribution: Great={row['great']} Good={row['good']} Poor={row['poor']} Terrible={row['terrible']}")
        lines.append(f"  Net driver change: ${row['d_net_change']/1e6:+.1f}M   Net constructor change: ${row['c_net_change']/1e6:+.1f}M")

    # ── Q5: Correction of known mispriced entities ───────────────────────
    lines.append("\n---\n")
    lines.append("## Q5: Preseason Mispricing Correction\n")
    lines.append("How quickly does the PPM model correct known preseason errors?\n")
    lines.append("Entities selected from unified model analysis: ANT (underpriced rookie),\n")
    lines.append("SAI (overpriced team changer), TSU (overpriced relative to actual performance).\n")

    for label, corr_key in [("Best config", "correction_best")]:
        lines.append(f"\n**{label}:**\n")
        corr = results[corr_key]
        for entity, data in corr.items():
            lines.append(f"\n  **{entity}** (expected: {data['direction']})")
            lines.append(f"    Preseason: ${data['preseason']/1e6:.1f}M → Final: ${data['final_price']/1e6:.1f}M "
                         f"({data['total_change_pct']:+.1%})")
            first = data['first_5pct_round']
            lines.append(f"    First ≥5% correction: {'R' + str(first) if first else 'never'}")
            # Price trajectory (sampled)
            prices = data['prices']
            checkpoints = [0, 2, 5, 7, 11, 17, 23]
            trajectory = "    Trajectory: " + " → ".join(
                f"R{i+1}=${prices[i]/1e6:.1f}M" for i in checkpoints if i < len(prices)
            )
            lines.append(trajectory)

    # ── Detail: Best configuration entity-by-entity ──────────────────────
    lines.append("\n---\n")
    lines.append("## Full Season Price Evolution (Best Configuration)\n")

    best = results.get("best_config_detail")
    if best:
        lines.append(f"\nConfiguration: {best['config_label']}\n")
        checkpoints = [1, 3, 6, 9, 12, 18, 24]

        lines.append("\n**Drivers:**\n")
        header = f"{'Driver':<8} {'Preseason':>10}"
        for r in checkpoints:
            header += f" {'R'+str(r):>8}"
        header += f" {'Season':>8} {'ΔTotal':>10}"
        lines.append(header)
        lines.append("-" * (28 + 9 * len(checkpoints) + 20))

        for d in sorted(best["d_prices"], key=lambda x: -best["d_preseason"].get(x, 0)):
            row_str = f"{d:<8} ${best['d_preseason'].get(d, 0)/1e6:>8.1f}M"
            for r in checkpoints:
                p = best["d_prices"][d].get(r, 0)
                row_str += f" ${p/1e6:>6.1f}M"
            final = best["d_prices"][d].get(TOTAL_ROUNDS, 0)
            pre = best["d_preseason"].get(d, 0)
            row_str += f" {best['d_season_totals'].get(d, 0):>8} ${(final - pre)/1e6:>+8.1f}M"
            lines.append(row_str)

        lines.append("\n**Constructors:**\n")
        header = f"{'Constructor':<22} {'Preseason':>10}"
        for r in checkpoints:
            header += f" {'R'+str(r):>8}"
        header += f" {'Season':>8} {'ΔTotal':>10}"
        lines.append(header)
        lines.append("-" * (42 + 9 * len(checkpoints) + 20))

        for c in sorted(best["c_prices"], key=lambda x: -best["c_preseason"].get(x, 0)):
            row_str = f"{c:<22} ${best['c_preseason'].get(c, 0)/1e6:>8.1f}M"
            for r in checkpoints:
                p = best["c_prices"][c].get(r, 0)
                row_str += f" ${p/1e6:>6.1f}M"
            final = best["c_prices"][c].get(TOTAL_ROUNDS, 0)
            pre = best["c_preseason"].get(c, 0)
            row_str += f" {best['c_season_totals'].get(c, 0):>8} ${(final - pre)/1e6:>+8.1f}M"
            lines.append(row_str)

    lines.append("")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")


# ── Main simulation ──────────────────────────────────────────────────────


def main() -> None:
    print("Loading data...", flush=True)
    per_round_driver = load_per_round_scores(DATA_2025_DIR / "driver_scores.csv", "driver")
    per_round_constructor = load_per_round_scores(DATA_2025_DIR / "constructor_scores.csv", "constructor")
    d_preseason, c_preseason = load_preseason_prices(PRICING_DIR / "preseason_prices_2025.csv")
    d_season_totals = load_season_totals(DATA_2025_DIR / "season_totals.csv", "driver")
    c_season_totals = load_season_totals(DATA_2025_DIR / "season_constructor_totals.csv", "constructor")
    print(f"  {len(d_preseason)} drivers, {len(c_preseason)} constructors loaded.")

    results: dict = {
        "d_preseason": d_preseason,
        "c_preseason": c_preseason,
    }

    # ── Q1: Actual PPM distributions ─────────────────────────────────────
    print("\nQ1: Computing actual PPM distributions...", flush=True)
    results["d_ppm_dist"] = compute_actual_ppm_distribution(per_round_driver, d_preseason, "driver")
    results["c_ppm_dist"] = compute_actual_ppm_distribution(per_round_constructor, c_preseason, "constructor")

    d_ppms = sorted(results["d_ppm_dist"].values())
    c_ppms = sorted(results["c_ppm_dist"].values())
    d_median = d_ppms[len(d_ppms) // 2] if d_ppms else 0
    c_median = c_ppms[len(c_ppms) // 2] if c_ppms else 0
    print(f"  Driver PPM — mean: {sum(d_ppms)/len(d_ppms):.3f}, median: {d_median:.3f}")
    print(f"  Constructor PPM — mean: {sum(c_ppms)/len(c_ppms):.3f}, median: {c_median:.3f}")

    # ── Q1: Neutral point sweep ──────────────────────────────────────────
    print("\nQ1: Sweeping neutral points...", flush=True)
    results["d_neutral_sweep"] = []
    results["c_neutral_sweep"] = []

    for neutral in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2]:
        # For drivers: sweep the neutral point (middle threshold)
        # Keep band width constant: terrible < neutral-0.3, poor < neutral, good < neutral+0.3
        d_thresh = (neutral - 0.3, neutral, neutral + 0.3)
        d_ph, _, d_ppm_h, _, d_bh, _ = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=d_thresh,
            c_thresholds=(0.6, 0.9, 1.2),  # hold constructors constant
        )
        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        net = sum(v["change"] for v in d_infl.values())
        inflated = sum(1 for v in d_infl.values() if v["direction"] == "inflated")
        deflated = sum(1 for v in d_infl.values() if v["direction"] == "deflated")
        stable = sum(1 for v in d_infl.values() if v["direction"] == "stable")
        bands = count_band_distribution(d_bh)
        results["d_neutral_sweep"].append({
            "neutral": neutral,
            "net_change": net,
            "inflated": inflated,
            "deflated": deflated,
            "stable": stable,
            **{b: bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        })
        print(f"  Driver neutral={neutral:.2f}: net=${net/1e6:+.1f}M, "
              f"inf={inflated} def={deflated} stb={stable}")

    for neutral in [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.5, 3.0]:
        c_thresh = (neutral - 0.3, neutral, neutral + 0.3)
        _, c_ph, _, _, _, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=(0.6, 0.9, 1.2),  # hold drivers constant
            c_thresholds=c_thresh,
        )
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        net = sum(v["change"] for v in c_infl.values())
        inflated = sum(1 for v in c_infl.values() if v["direction"] == "inflated")
        deflated = sum(1 for v in c_infl.values() if v["direction"] == "deflated")
        stable = sum(1 for v in c_infl.values() if v["direction"] == "stable")
        bands = count_band_distribution(c_bh)
        results["c_neutral_sweep"].append({
            "neutral": neutral,
            "net_change": net,
            "inflated": inflated,
            "deflated": deflated,
            "stable": stable,
            **{b: bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        })
        print(f"  Constructor neutral={neutral:.2f}: net=${net/1e6:+.1f}M, "
              f"inf={inflated} def={deflated} stb={stable}")

    # Find best neutral points (closest to net=0)
    best_d_neutral = min(results["d_neutral_sweep"], key=lambda x: abs(x["net_change"]))
    best_c_neutral = min(results["c_neutral_sweep"], key=lambda x: abs(x["net_change"]))
    print(f"\n  Best driver neutral: {best_d_neutral['neutral']:.2f} (net=${best_d_neutral['net_change']/1e6:+.1f}M)")
    print(f"  Best constructor neutral: {best_c_neutral['neutral']:.2f} (net=${best_c_neutral['net_change']/1e6:+.1f}M)")

    best_d_n = best_d_neutral["neutral"]
    best_c_n = best_c_neutral["neutral"]
    results["best_d_n_orig"] = best_d_n
    results["best_c_n_orig"] = best_c_n

    def _make_uniform(outer: int) -> dict[str, int]:
        inner = max(100_000, round(outer / 3 / 100_000) * 100_000)
        return {"great": outer, "good": inner, "poor": -inner, "terrible": -outer}

    # ── Band Width Sweep ──────────────────────────────────────────────────
    # The ±0.30 band width produces 72% extreme-band classifications,
    # making the system effectively binary. Sweep wider widths to find
    # a more balanced distribution before calibrating step magnitudes.
    # Uses per-type steps from prior analysis as baseline (D=$0.40M, C=$0.60M).
    print("\nBand Width Sweep: testing wider band thresholds...", flush=True)
    results["band_width_sweep"] = []

    bw_d_steps = _make_uniform(400_000)
    bw_c_steps = _make_uniform(600_000)

    for half_width in [0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 1.00]:
        d_thresh = (best_d_n - half_width, best_d_n, best_d_n + half_width)
        c_thresh = (best_c_n - half_width, best_c_n, best_c_n + half_width)

        d_ph, c_ph, _, _, d_bh, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=d_thresh,
            c_thresholds=c_thresh,
            d_steps_a=bw_d_steps, d_steps_b=bw_d_steps,
            c_steps_a=bw_c_steps, c_steps_b=bw_c_steps,
        )

        d_bands = count_band_distribution(d_bh)
        c_bands = count_band_distribution(c_bh)
        all_bands = dict(d_bands)
        for b, cnt in c_bands.items():
            all_bands[b] = all_bands.get(b, 0) + cnt

        total = sum(all_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"])
        band_pcts = {
            b: all_bands.get(b, 0) / total if total > 0 else 0
            for b in ["great", "good", "poor", "terrible"]
        }
        imbalance = sum((band_pcts[b] - 0.25) ** 2 for b in ["great", "good", "poor", "terrible"])

        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        d_net = sum(v["change"] for v in d_infl.values())
        c_net = sum(v["change"] for v in c_infl.values())
        max_swing = max(compute_max_3race_swing(d_ph)[0], compute_max_3race_swing(c_ph)[0])

        d_floor_pinned = sum(
            1 for d in d_ph
            if sum(1 for r in d_ph[d].values() if r <= DRIVER_FLOOR) >= TOTAL_ROUNDS * 0.5
        )
        c_floor_pinned = sum(
            1 for c in c_ph
            if sum(1 for r in c_ph[c].values() if r <= CONSTRUCTOR_FLOOR) >= TOTAL_ROUNDS * 0.5
        )

        d_total = sum(d_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"])
        c_total = sum(c_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"])
        d_band_pcts = {b: d_bands.get(b, 0) / d_total if d_total > 0 else 0
                       for b in ["great", "good", "poor", "terrible"]}
        c_band_pcts = {b: c_bands.get(b, 0) / c_total if c_total > 0 else 0
                       for b in ["great", "good", "poor", "terrible"]}

        row = {
            "half_width": half_width,
            "imbalance": imbalance,
            "d_net_change": d_net,
            "c_net_change": c_net,
            "max_3r_swing": max_swing,
            "d_floor_pinned": d_floor_pinned,
            "c_floor_pinned": c_floor_pinned,
            **{b: all_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
            **{f"{b}_pct": band_pcts[b] for b in ["great", "good", "poor", "terrible"]},
            **{f"d_{b}": d_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
            **{f"c_{b}": c_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
            **{f"d_{b}_pct": d_band_pcts[b] for b in ["great", "good", "poor", "terrible"]},
            **{f"c_{b}_pct": c_band_pcts[b] for b in ["great", "good", "poor", "terrible"]},
        }
        results["band_width_sweep"].append(row)
        print(f"  ±{half_width:.2f}: "
              f"G:{all_bands.get('great',0):>3}({band_pcts['great']:.0%}) "
              f"g:{all_bands.get('good',0):>3}({band_pcts['good']:.0%}) "
              f"p:{all_bands.get('poor',0):>3}({band_pcts['poor']:.0%}) "
              f"T:{all_bands.get('terrible',0):>3}({band_pcts['terrible']:.0%}) "
              f"imb={imbalance:.4f} "
              f"d_net=${d_net/1e6:+.1f}M c_net=${c_net/1e6:+.1f}M "
              f"floor={d_floor_pinned}D+{c_floor_pinned}C")

    # Select best band width: most balanced distribution (lowest imbalance)
    best_bw = min(results["band_width_sweep"], key=lambda x: x["imbalance"])
    best_half_width = best_bw["half_width"]
    results["best_half_width"] = best_half_width
    print(f"\n  Best band width: ±{best_half_width:.2f} "
          f"(imbalance={best_bw['imbalance']:.4f}, "
          f"G={best_bw['great_pct']:.0%} g={best_bw['good_pct']:.0%} "
          f"p={best_bw['poor_pct']:.0%} T={best_bw['terrible_pct']:.0%})")

    # ── Q2: Uniform step magnitude sweep ────────────────────────────────
    # Sweep outer step magnitudes (great/terrible bands) directly.
    # Inner (good/poor) = outer / 3, rounded to nearest $100k, min $100k.
    # All entities use the same steps (no tiers) — pure magnitude test.
    # Band width from sweep above (±best_half_width instead of ±0.30).
    print("\nQ2: Sweeping uniform step magnitudes...", flush=True)
    results["step_sweep"] = []

    best_d_thresh = (best_d_n - best_half_width, best_d_n, best_d_n + best_half_width)
    best_c_thresh = (best_c_n - best_half_width, best_c_n, best_c_n + best_half_width)

    def _combined_round_changes(d_ph, c_ph):
        all_d = list(d_ph.keys())
        all_c = list(c_ph.keys())
        changes = []
        if all_d:
            rounds = sorted(d_ph[all_d[0]].keys())
            for i in range(1, len(rounds)):
                total = (
                    sum(abs(d_ph[e][rounds[i]] - d_ph[e][rounds[i-1]]) for e in all_d) +
                    sum(abs(c_ph[e][rounds[i]] - c_ph[e][rounds[i-1]]) for e in all_c)
                )
                changes.append(total)
        return changes

    for outer in [100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 900_000]:
        uniform = _make_uniform(outer)
        d_ph, c_ph, _, _, d_bh, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=best_d_thresh,
            c_thresholds=best_c_thresh,
            d_steps_a=uniform, d_steps_b=uniform,
            c_steps_a=uniform, c_steps_b=uniform,
        )
        max_swing = max(compute_max_3race_swing(d_ph)[0], compute_max_3race_swing(c_ph)[0])
        combined = _combined_round_changes(d_ph, c_ph)
        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        d_net = sum(v["change"] for v in d_infl.values())
        c_net = sum(v["change"] for v in c_infl.values())
        d_maxp = compute_max_prices(d_ph)
        c_maxp = compute_max_prices(c_ph)
        all_bands = count_band_distribution(d_bh)
        for b, cnt in count_band_distribution(c_bh).items():
            all_bands[b] = all_bands.get(b, 0) + cnt

        row = {
            "outer": outer,
            "inner": uniform["good"],
            "max_3r_swing": max_swing,
            "avg_round_change": sum(combined) / len(combined) if combined else 0,
            "d_max_price": max(d_maxp.values()) if d_maxp else 0,
            "c_max_price": max(c_maxp.values()) if c_maxp else 0,
            "d_net_change": d_net,
            "c_net_change": c_net,
            **{b: all_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        }
        results["step_sweep"].append(row)
        print(f"  outer=${outer/1e6:.2f}M inner=${uniform['good']/1e6:.2f}M: "
              f"swing={max_swing:.1%}, avg_Δ=${row['avg_round_change']/1e6:.1f}M, "
              f"d_net=${d_net/1e6:+.1f}M c_net=${c_net/1e6:+.1f}M "
              f"d_max=${row['d_max_price']/1e6:.1f}M c_max=${row['c_max_price']/1e6:.1f}M")

    # Best: lowest absolute combined drift, within max swing ≤ 30%
    valid_steps = [r for r in results["step_sweep"] if r["max_3r_swing"] <= 0.30]
    if not valid_steps:
        valid_steps = results["step_sweep"]
    best_step_row = min(valid_steps, key=lambda x: abs(x["d_net_change"]) + abs(x["c_net_change"]))
    best_outer = best_step_row["outer"]
    best_uniform_steps = _make_uniform(best_outer)
    print(f"\n  Best uniform: outer=${best_outer/1e6:.2f}M inner=${best_uniform_steps['good']/1e6:.2f}M "
          f"(d_net=${best_step_row['d_net_change']/1e6:+.1f}M, "
          f"c_net=${best_step_row['c_net_change']/1e6:+.1f}M, "
          f"swing={best_step_row['max_3r_swing']:.1%})")

    # ── Q3: Do tiers improve on the best uniform? ────────────────────────
    # Given the best uniform outer from Q2, test whether splitting entities
    # into two step tiers (cheaper entities get larger steps) produces better
    # drift or correction speed. A-tier (expensive) < uniform < B-tier (cheap).
    print("\nQ3: Testing uniform vs tiered step sizes...", flush=True)
    results["tier_sweep"] = []

    def _run_tier_config(label, d_sa, d_sb, c_sa, c_sb, d_bound, c_bound):
        d_ph, c_ph, _, _, d_bh, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=best_d_thresh,
            c_thresholds=best_c_thresh,
            d_tier_boundary=d_bound,
            c_tier_boundary=c_bound,
            d_steps_a=d_sa, d_steps_b=d_sb,
            c_steps_a=c_sa, c_steps_b=c_sb,
        )
        max_swing = max(
            compute_max_3race_swing(d_ph)[0],
            compute_max_3race_swing(c_ph)[0],
        )
        combined = _combined_round_changes(d_ph, c_ph)
        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        d_net = sum(v["change"] for v in d_infl.values())
        c_net = sum(v["change"] for v in c_infl.values())
        d_maxp = compute_max_prices(d_ph)
        c_maxp = compute_max_prices(c_ph)
        all_bands = count_band_distribution(d_bh)
        for b, cnt in count_band_distribution(c_bh).items():
            all_bands[b] = all_bands.get(b, 0) + cnt

        row = {
            "label": label,
            "d_boundary": d_bound,
            "c_boundary": c_bound,
            "max_3r_swing": max_swing,
            "avg_round_change": sum(combined) / len(combined) if combined else 0,
            "d_net_change": d_net,
            "c_net_change": c_net,
            "d_max_price": max(d_maxp.values()) if d_maxp else 0,
            "c_max_price": max(c_maxp.values()) if c_maxp else 0,
            **{b: all_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        }
        results["tier_sweep"].append(row)
        print(f"  {label}: swing={max_swing:.1%}, "
              f"d_net=${d_net/1e6:+.1f}M c_net=${c_net/1e6:+.1f}M "
              f"avg_Δ=${row['avg_round_change']/1e6:.1f}M")
        return row

    # Control: best uniform from Q2 (no tiers, same steps for both types)
    print("  --- Part A: Control — uniform (same steps for all) ---")
    _run_tier_config(
        f"Uniform outer=${best_outer/1e6:.2f}M",
        best_uniform_steps, best_uniform_steps,
        best_uniform_steps, best_uniform_steps,
        0, 0,
    )

    # Part B: Separate uniform steps per entity type (no tiers, no price boundary)
    # Drivers and constructors get independently calibrated uniform steps.
    print("  --- Part B: Separate uniform per type ---")
    results["per_type_sweep"] = []
    outer_values_sweep = [100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 900_000]

    for d_outer in outer_values_sweep:
        for c_outer in outer_values_sweep:
            d_steps = _make_uniform(d_outer)
            c_steps = _make_uniform(c_outer)
            d_ph, c_ph, _, _, d_bh, c_bh = simulate_ppm_season(
                d_preseason, c_preseason,
                per_round_driver, per_round_constructor,
                d_thresholds=best_d_thresh,
                c_thresholds=best_c_thresh,
                d_steps_a=d_steps, d_steps_b=d_steps,
                c_steps_a=c_steps, c_steps_b=c_steps,
            )
            max_swing = max(
                compute_max_3race_swing(d_ph)[0],
                compute_max_3race_swing(c_ph)[0],
            )
            combined = _combined_round_changes(d_ph, c_ph)
            d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
            c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
            d_net = sum(v["change"] for v in d_infl.values())
            c_net = sum(v["change"] for v in c_infl.values())
            d_maxp = compute_max_prices(d_ph)
            c_maxp = compute_max_prices(c_ph)
            label = f"PerType D=${d_outer/1e6:.2f}M C=${c_outer/1e6:.2f}M"
            row = {
                "label": label,
                "d_outer": d_outer,
                "c_outer": c_outer,
                "d_boundary": 0,
                "c_boundary": 0,
                "max_3r_swing": max_swing,
                "avg_round_change": sum(combined) / len(combined) if combined else 0,
                "d_net_change": d_net,
                "c_net_change": c_net,
                "d_max_price": max(d_maxp.values()) if d_maxp else 0,
                "c_max_price": max(c_maxp.values()) if c_maxp else 0,
            }
            results["per_type_sweep"].append(row)
            results["tier_sweep"].append(row)
            print(f"  {label}: swing={max_swing:.1%}, "
                  f"d_net=${d_net/1e6:+.1f}M c_net=${c_net/1e6:+.1f}M "
                  f"avg_Δ=${row['avg_round_change']/1e6:.1f}M")

    # Best per-type config
    valid_pt = [r for r in results["per_type_sweep"] if r["max_3r_swing"] <= 0.30]
    if not valid_pt:
        valid_pt = results["per_type_sweep"]
    best_pt = min(valid_pt, key=lambda x: abs(x["d_net_change"]) + abs(x["c_net_change"]))
    print(f"\n  Best per-type: {best_pt['label']} "
          f"(d_net=${best_pt['d_net_change']/1e6:+.1f}M, "
          f"c_net=${best_pt['c_net_change']/1e6:+.1f}M, "
          f"swing={best_pt['max_3r_swing']:.1%})")

    # Part C: Tiered — price-based A/B boundary
    # B-tier = best uniform outer; A-tier at fractions of B (50%, 67%, 75%)
    # Also test B-tier > best uniform (1.5×, 2×) with A-tier = best uniform
    print("  --- Part C: Tiered (price-based A/B boundary) ---")
    a_fractions = [0.50, 0.67, 0.75]   # A-tier outer as fraction of best_outer
    b_multiples = [1.00, 1.50, 2.00]   # B-tier outer as multiple of best_outer

    d_boundaries = [10_000_000, 13_000_000, 15_000_000, 17_000_000, 19_000_000]
    c_boundaries = [16_000_000, 19_000_000, 21_000_000, 23_000_000, 25_000_000]

    for a_frac in a_fractions:
        for b_mult in b_multiples:
            if a_frac == 1.0 and b_mult == 1.0:
                continue  # same as uniform, already tested
            a_outer = max(100_000, round(best_outer * a_frac / 100_000) * 100_000)
            b_outer = round(best_outer * b_mult / 100_000) * 100_000
            steps_a = _make_uniform(a_outer)
            steps_b = _make_uniform(b_outer)
            ratio_label = f"A={a_frac:.0%}×B={b_mult:.0%}×"
            for d_bound in d_boundaries:
                for c_bound in c_boundaries:
                    _run_tier_config(
                        f"Tiered {ratio_label} D≥${d_bound/1e6:.0f}M C≥${c_bound/1e6:.0f}M",
                        steps_a, steps_b, steps_a, steps_b, d_bound, c_bound,
                    )

    # Best Q3 config: lowest absolute combined drift within ≤ 30% swing
    valid_tier = [r for r in results["tier_sweep"] if r["max_3r_swing"] <= 0.30]
    if not valid_tier:
        valid_tier = results["tier_sweep"]
    best_tier = min(valid_tier, key=lambda x: abs(x["d_net_change"]) + abs(x["c_net_change"]))
    best_tier_label = best_tier["label"]

    # Extract step dicts and boundaries for Q4/Q5
    if best_tier_label.startswith("Uniform"):
        best_d_bound = 0
        best_c_bound = 0
        best_final_d_a = best_uniform_steps
        best_final_d_b = best_uniform_steps
        best_final_c_a = best_uniform_steps
        best_final_c_b = best_uniform_steps
    elif best_tier_label.startswith("PerType"):
        best_d_bound = 0
        best_c_bound = 0
        d_steps = _make_uniform(best_tier["d_outer"])
        c_steps = _make_uniform(best_tier["c_outer"])
        best_final_d_a = d_steps
        best_final_d_b = d_steps
        best_final_c_a = c_steps
        best_final_c_b = c_steps
    else:
        best_d_bound = best_tier["d_boundary"]
        best_c_bound = best_tier["c_boundary"]
        # Reconstruct steps from label: "Tiered A=XX%×B=YY%× D≥$ZM C≥$WM"
        m = re.match(r"Tiered A=(\d+)%×B=(\d+)%×", best_tier_label)
        if m:
            a_frac = int(m.group(1)) / 100
            b_mult = int(m.group(2)) / 100
            a_outer = max(100_000, round(best_outer * a_frac / 100_000) * 100_000)
            b_outer = round(best_outer * b_mult / 100_000) * 100_000
            best_final_d_a = _make_uniform(a_outer)
            best_final_d_b = _make_uniform(b_outer)
            best_final_c_a = _make_uniform(a_outer)
            best_final_c_b = _make_uniform(b_outer)
        else:
            best_final_d_a = best_uniform_steps
            best_final_d_b = best_uniform_steps
            best_final_c_a = best_uniform_steps
            best_final_c_b = best_uniform_steps

    print(f"\n  Best Q3 config: {best_tier_label} "
          f"(d_net=${best_tier['d_net_change']/1e6:+.1f}M, "
          f"c_net=${best_tier['c_net_change']/1e6:+.1f}M, "
          f"swing={best_tier['max_3r_swing']:.1%})")

    # ── Q1 recalibration at Q3 winning step config ───────────────────────
    # The neutral points from Q1 were found at the Q1 default step config.
    # Now that Q3 has selected a (possibly different) step configuration,
    # re-sweep the neutral points using those steps to verify the drift
    # result is structural, not a coincidence of miscalibrated neutrals.
    print("\nQ1 recalibration: re-sweeping neutral points at Q3 winning steps...", flush=True)
    results["d_neutral_recal"] = []
    results["c_neutral_recal"] = []

    for neutral in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5]:
        d_thresh = (neutral - best_half_width, neutral, neutral + best_half_width)
        d_ph, _, _, _, d_bh, _ = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=d_thresh,
            c_thresholds=best_c_thresh,
            d_tier_boundary=best_d_bound,
            c_tier_boundary=best_c_bound,
            d_steps_a=best_final_d_a, d_steps_b=best_final_d_b,
            c_steps_a=best_final_c_a, c_steps_b=best_final_c_b,
        )
        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        net = sum(v["change"] for v in d_infl.values())
        inflated = sum(1 for v in d_infl.values() if v["direction"] == "inflated")
        deflated = sum(1 for v in d_infl.values() if v["direction"] == "deflated")
        stable = sum(1 for v in d_infl.values() if v["direction"] == "stable")
        bands = count_band_distribution(d_bh)
        results["d_neutral_recal"].append({
            "neutral": neutral,
            "net_change": net,
            "inflated": inflated,
            "deflated": deflated,
            "stable": stable,
            **{b: bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        })
        print(f"  Driver neutral={neutral:.2f}: net=${net/1e6:+.1f}M, "
              f"inf={inflated} def={deflated} stb={stable}")

    for neutral in [0.5, 0.8, 1.0, 1.2, 1.5, 1.8, 2.0, 2.2, 2.5, 3.0]:
        c_thresh = (neutral - best_half_width, neutral, neutral + best_half_width)
        _, c_ph, _, _, _, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=best_d_thresh,
            c_thresholds=c_thresh,
            d_tier_boundary=best_d_bound,
            c_tier_boundary=best_c_bound,
            d_steps_a=best_final_d_a, d_steps_b=best_final_d_b,
            c_steps_a=best_final_c_a, c_steps_b=best_final_c_b,
        )
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        net = sum(v["change"] for v in c_infl.values())
        inflated = sum(1 for v in c_infl.values() if v["direction"] == "inflated")
        deflated = sum(1 for v in c_infl.values() if v["direction"] == "deflated")
        stable = sum(1 for v in c_infl.values() if v["direction"] == "stable")
        bands = count_band_distribution(c_bh)
        results["c_neutral_recal"].append({
            "neutral": neutral,
            "net_change": net,
            "inflated": inflated,
            "deflated": deflated,
            "stable": stable,
            **{b: bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        })
        print(f"  Constructor neutral={neutral:.2f}: net=${net/1e6:+.1f}M, "
              f"inf={inflated} def={deflated} stb={stable}")

    best_d_recal = min(results["d_neutral_recal"], key=lambda x: abs(x["net_change"]))
    best_c_recal = min(results["c_neutral_recal"], key=lambda x: abs(x["net_change"]))
    recal_d_n = best_d_recal["neutral"]
    recal_c_n = best_c_recal["neutral"]
    print(f"\n  Recalibrated driver neutral: {recal_d_n:.2f} "
          f"(was {best_d_n:.2f}, net=${best_d_recal['net_change']/1e6:+.1f}M)")
    print(f"  Recalibrated constructor neutral: {recal_c_n:.2f} "
          f"(was {best_c_n:.2f}, net=${best_c_recal['net_change']/1e6:+.1f}M)")

    # Update thresholds for Q4/Q5
    best_d_thresh = (recal_d_n - best_half_width, recal_d_n, recal_d_n + best_half_width)
    best_c_thresh = (recal_c_n - best_half_width, recal_c_n, recal_c_n + best_half_width)

    # ── Q4: Window weighting ─────────────────────────────────────────────
    print("\nQ4: Comparing window weightings...", flush=True)
    results["window_sweep"] = []

    weight_configs = [
        ("Equal (1/1/1)", None, "1:1:1"),
        ("Light recency (2/1/1)", [1.0, 1.0, 2.0], "1:1:2"),
        ("Moderate recency (3/2/1)", [1.0, 2.0, 3.0], "1:2:3"),
        ("Heavy recency (4/2/1)", [1.0, 2.0, 4.0], "1:2:4"),
        ("F1 Fantasy Tools (4/2/1 normalized)", [1/7, 2/7, 4/7], "1:2:4 norm"),
    ]

    for label, weights, wlabel in weight_configs:
        d_ph, c_ph, _, _, d_bh, c_bh = simulate_ppm_season(
            d_preseason, c_preseason,
            per_round_driver, per_round_constructor,
            d_thresholds=best_d_thresh,
            c_thresholds=best_c_thresh,
            d_tier_boundary=best_d_bound,
            c_tier_boundary=best_c_bound,
            d_steps_a=best_final_d_a, d_steps_b=best_final_d_b,
            c_steps_a=best_final_c_a, c_steps_b=best_final_c_b,
            weights=weights,
        )
        max_swing = max(
            compute_max_3race_swing(d_ph)[0],
            compute_max_3race_swing(c_ph)[0],
        )
        combined_changes = []
        all_d = list(d_ph.keys())
        all_c = list(c_ph.keys())
        if all_d:
            rounds = sorted(d_ph[all_d[0]].keys())
            for i in range(1, len(rounds)):
                total = (
                    sum(abs(d_ph[e][rounds[i]] - d_ph[e][rounds[i-1]]) for e in all_d) +
                    sum(abs(c_ph[e][rounds[i]] - c_ph[e][rounds[i-1]]) for e in all_c)
                )
                combined_changes.append(total)

        d_infl = analyze_inflation_deflation(d_ph, d_preseason, "driver")
        c_infl = analyze_inflation_deflation(c_ph, c_preseason, "constructor")
        bands = {**count_band_distribution(d_bh), **{f"c_{k}": v for k, v in count_band_distribution(c_bh).items()}}
        all_bands = count_band_distribution(d_bh)
        cb = count_band_distribution(c_bh)
        for b in cb:
            all_bands[b] = all_bands.get(b, 0) + cb[b]

        results["window_sweep"].append({
            "label": label,
            "weights_label": wlabel,
            "max_3r_swing": max_swing,
            "avg_round_change": sum(combined_changes) / len(combined_changes) if combined_changes else 0,
            "max_round_change": max(combined_changes) if combined_changes else 0,
            "d_net_change": sum(v["change"] for v in d_infl.values()),
            "c_net_change": sum(v["change"] for v in c_infl.values()),
            **{b: all_bands.get(b, 0) for b in ["great", "good", "poor", "terrible"]},
        })
        print(f"  {label}: swing={max_swing:.1%}, avg_Δ=${results['window_sweep'][-1]['avg_round_change']/1e6:.1f}M")

    # ── Q5: Correction speed ─────────────────────────────────────────────
    print("\nQ5: Measuring correction speed for known mispriced entities...", flush=True)

    known_mispriced_drivers = {
        "ANT": "under",   # Rookie priced at team avg $13.1M, actual performance much lower
        "SAI": "over",    # Team changer priced at $10M, went to weaker team
        "TSU": "over",    # $10.7M preseason but inconsistent performer
    }

    # Run best config
    d_ph, c_ph, _, _, _, _ = simulate_ppm_season(
        d_preseason, c_preseason,
        per_round_driver, per_round_constructor,
        d_thresholds=best_d_thresh,
        c_thresholds=best_c_thresh,
        d_tier_boundary=best_d_bound,
        c_tier_boundary=best_c_bound,
        d_steps_a=best_final_d_a, d_steps_b=best_final_d_b,
        c_steps_a=best_final_c_a, c_steps_b=best_final_c_b,
    )

    results["correction_best"] = analyze_correction_speed(
        d_ph, per_round_driver, d_preseason, d_season_totals, "driver",
        known_mispriced_drivers,
    )
    for entity, data in results["correction_best"].items():
        first = data["first_5pct_round"]
        print(f"  {entity}: ${data['preseason']/1e6:.1f}M → ${data['final_price']/1e6:.1f}M "
              f"({data['total_change_pct']:+.1%}), 5% at {'R' + str(first) if first else 'never'}")

    # ── Best config detail ───────────────────────────────────────────────
    results["best_config_detail"] = {
        "config_label": (
            f"D neutral={best_d_n:.2f}, C neutral={best_c_n:.2f}, "
            f"Q2 outer=${best_outer/1e6:.2f}M, Q3={best_tier_label}, equal weight"
        ),
        "d_prices": d_ph,
        "c_prices": c_ph,
        "d_preseason": d_preseason,
        "c_preseason": c_preseason,
        "d_season_totals": d_season_totals,
        "c_season_totals": c_season_totals,
    }

    # ── Write report ─────────────────────────────────────────────────────
    PPM_DIR.mkdir(parents=True, exist_ok=True)
    report_path = PPM_DIR / "ppm_simulation_report.md"
    print(f"\nWriting report to {report_path}...", flush=True)
    generate_report(results, report_path)

    # ── Write price evolution CSV ────────────────────────────────────────
    evo_path = PPM_DIR / "ppm_price_evolution.csv"
    rows = []
    for d, rounds in d_ph.items():
        for r, price in rounds.items():
            rows.append({"round": r, "entity": d, "type": "driver", "price": price})
    for c, rounds in c_ph.items():
        for r, price in rounds.items():
            rows.append({"round": r, "entity": c, "type": "constructor", "price": price})
    rows.sort(key=lambda x: (x["round"], x["type"], x["entity"]))
    with open(evo_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["round", "entity", "type", "price"])
        w.writeheader()
        w.writerows(rows)

    print(f"\nDone. Output files:")
    print(f"  {report_path}")
    print(f"  {evo_path}")


if __name__ == "__main__":
    main()
