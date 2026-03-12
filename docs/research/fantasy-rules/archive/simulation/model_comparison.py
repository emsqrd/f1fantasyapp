"""
model_comparison.py — Side-by-side comparison of Power Curve vs Multiplier pricing.

Evaluates both approaches across:
  1. Price distribution & spread
  2. PPM (points per million) values
  3. Dream team cost & tightness at multiple budget caps
  4. Optimal team composition at multiple budget caps
  5. Team diversity (feasible teams, within 80% of best)
  6. Preseason mispricing (how well prices predict actual scoring value)

Uses 2024 inputs → 2025 prices, validated against 2025 actual scores.
"""

import csv
import itertools
import statistics
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

TEAM_DRIVERS = 5
TEAM_CONSTRUCTORS = 3
TOTAL_RACES = 24

# ── Load 2024 per-race averages (inputs for preseason pricing) ───────────

# From the existing preseason_prices_2025.csv, extract the 2024 averages
DRIVER_AVG_2024: dict[str, float | None] = {}
CONSTRUCTOR_AVG_2024: dict[str, float | None] = {}

with open(OUTPUT_DIR / "pricing/preseason_prices_2025.csv") as f:
    for row in csv.DictReader(f):
        avg_str = row["avg_2024"]
        if row["type"] == "driver":
            DRIVER_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)
        else:
            CONSTRUCTOR_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)

# ── Load 2025 actual scores (for validation) ────────────────────────────

DRIVER_SCORES_2025: dict[str, int] = {}
CONSTRUCTOR_SCORES_2025: dict[str, int] = {}

with open(OUTPUT_DIR / "2025/season_totals.csv") as f:
    for row in csv.DictReader(f):
        DRIVER_SCORES_2025[row["driver"]] = int(row["season_total"])

with open(OUTPUT_DIR / "2025/season_constructor_totals.csv") as f:
    for row in csv.DictReader(f):
        CONSTRUCTOR_SCORES_2025[row["constructor"]] = int(row["season_total"])


# ── Pricing formulas ────────────────────────────────────────────────────


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_prices(
    avgs: dict[str, float | None],
    entity_type: str,
    floor: int,
    ceiling: int,
    ref_max: float,
    shape: float = 1.0,
) -> dict[str, int]:
    """Power curve: price = max(floor, floor + (ceiling - floor) × (avg/ref_max)^shape)"""
    prices = {}
    for name, avg in avgs.items():
        if avg is None or avg <= 0:
            prices[name] = floor
        else:
            norm = max(0.0, min(1.0, avg / ref_max))
            prices[name] = max(floor, round_100k(floor + (ceiling - floor) * norm ** shape))
    return prices


def multiplier_prices(
    avgs: dict[str, float | None],
    k: float,
    floor: int,
) -> dict[str, int]:
    """Multiplier: price = max(floor, k × avg)"""
    prices = {}
    for name, avg in avgs.items():
        if avg is None or avg <= 0:
            prices[name] = floor
        else:
            prices[name] = max(floor, round_100k(k * avg))
    return prices


# ── Analysis functions ───────────────────────────────────────────────────


def dream_team(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
) -> tuple[list[str], list[str], int]:
    """Top 5D + top 3C by 2025 actual score, return (drivers, constructors, cost)."""
    top_d = sorted(DRIVER_SCORES_2025, key=lambda d: -DRIVER_SCORES_2025[d])[:TEAM_DRIVERS]
    top_c = sorted(CONSTRUCTOR_SCORES_2025, key=lambda c: -CONSTRUCTOR_SCORES_2025[c])[:TEAM_CONSTRUCTORS]
    cost = (
        sum(driver_prices.get(d, 0) for d in top_d)
        + sum(constructor_prices.get(c, 0) for c in top_c)
    )
    return top_d, top_c, cost


def best_affordable_team(
    driver_prices: dict[str, int],
    constructor_prices: dict[str, int],
    budget_cap: int,
) -> dict:
    """Brute-force the best-scoring feasible team under budget."""
    d_names = sorted(driver_prices)
    c_names = sorted(constructor_prices)
    d_costs = [driver_prices[d] for d in d_names]
    c_costs = [constructor_prices[c] for c in c_names]
    d_scores = [DRIVER_SCORES_2025.get(d, 0) for d in d_names]
    c_scores = [CONSTRUCTOR_SCORES_2025.get(c, 0) for c in c_names]

    c_combos = list(itertools.combinations(range(len(c_names)), TEAM_CONSTRUCTORS))
    c_combo_costs = [sum(c_costs[i] for i in combo) for combo in c_combos]
    c_combo_scores = [sum(c_scores[i] for i in combo) for combo in c_combos]
    min_c_cost = min(c_combo_costs) if c_combo_costs else 0

    feasible_scores: list[int] = []
    best_score = -1
    best_d_combo = None
    best_c_idx = None
    best_cost = 0

    for d_combo in itertools.combinations(range(len(d_names)), TEAM_DRIVERS):
        d_cost = sum(d_costs[i] for i in d_combo)
        remaining = budget_cap - d_cost
        if remaining < min_c_cost:
            continue
        d_score = sum(d_scores[i] for i in d_combo)
        for ci, c_cost in enumerate(c_combo_costs):
            if c_cost <= remaining:
                total = d_score + c_combo_scores[ci]
                feasible_scores.append(total)
                if total > best_score:
                    best_score = total
                    best_d_combo = d_combo
                    best_c_idx = ci
                    best_cost = d_cost + c_cost

    if not feasible_scores:
        return {"feasible": 0, "best_score": 0, "within_80pct": 0,
                "drivers": [], "constructors": [], "cost": 0,
                "dream_overlap_d": 0, "dream_overlap_c": 0}

    within_80 = sum(1 for s in feasible_scores if s >= 0.8 * best_score)
    drivers = [d_names[i] for i in best_d_combo]
    constructors = [c_names[i] for i in c_combos[best_c_idx]]

    dt_d, dt_c, _ = dream_team({}, {})  # just need the names
    dream_d_overlap = sum(1 for d in drivers if d in dt_d)
    dream_c_overlap = sum(1 for c in constructors if c in dt_c)

    return {
        "feasible": len(feasible_scores),
        "best_score": best_score,
        "within_80pct": within_80,
        "drivers": drivers,
        "constructors": constructors,
        "cost": best_cost,
        "dream_overlap_d": dream_d_overlap,
        "dream_overlap_c": dream_c_overlap,
    }


def ppm(score: int, price: int) -> float:
    """Points per million (per race)."""
    if price <= 0:
        return 0.0
    return (score / TOTAL_RACES) / (price / 1_000_000)


def fmt_m(x: int) -> str:
    return f"${x / 1e6:.1f}M"


# ── Define scenarios ─────────────────────────────────────────────────────

# Power curve reference maxima (2024 best per-race averages)
DRIVER_REF_MAX = 29.29   # VER
CONSTRUCTOR_REF_MAX = 35.33  # McLaren

scenarios: list[dict] = []

# Power Curve variants
for floor_label, d_floor, c_floor in [("$6M", 6_000_000, 6_000_000), ("$3M", 3_000_000, 3_000_000)]:
    d_prices = power_curve_prices(DRIVER_AVG_2024, "driver", d_floor, 19_000_000, DRIVER_REF_MAX)
    c_prices = power_curve_prices(CONSTRUCTOR_AVG_2024, "constructor", c_floor, 25_000_000, CONSTRUCTOR_REF_MAX)
    scenarios.append({
        "name": f"Power Curve ({floor_label} floor)",
        "driver_prices": d_prices,
        "constructor_prices": c_prices,
        "d_floor": d_floor,
        "c_floor": c_floor,
    })

# Multiplier variants — calibrate k so VER hits target price
ver_avg = DRIVER_AVG_2024["VER"]
mclaren_avg = CONSTRUCTOR_AVG_2024["McLaren"]

for ver_target, floor_label, d_floor, c_floor in [
    (22_000_000, "$3M", 3_000_000, 3_000_000),
    (22_000_000, "$6M", 6_000_000, 6_000_000),
    (24_000_000, "$3M", 3_000_000, 3_000_000),
    (24_000_000, "$6M", 6_000_000, 6_000_000),
]:
    d_k = ver_target / ver_avg
    # Calibrate constructor k so McLaren hits proportional target
    # Use the same ratio: constructor_k / driver_k = CONSTRUCTOR_CEILING / DRIVER_CEILING
    c_k = d_k * (25_000_000 / 19_000_000)
    d_prices = multiplier_prices(DRIVER_AVG_2024, d_k, d_floor)
    c_prices = multiplier_prices(CONSTRUCTOR_AVG_2024, c_k, c_floor)
    scenarios.append({
        "name": f"Multiplier (VER ${ver_target // 1_000_000}M, {floor_label} floor)",
        "driver_prices": d_prices,
        "constructor_prices": c_prices,
        "d_floor": d_floor,
        "c_floor": c_floor,
    })


# ── Run comparison ───────────────────────────────────────────────────────

BUDGET_CAPS = [100_000_000, 105_000_000, 110_000_000]

print("=" * 80)
print("  PRICING MODEL COMPARISON: POWER CURVE vs MULTIPLIER")
print("=" * 80)

for scenario in scenarios:
    name = scenario["name"]
    dp = scenario["driver_prices"]
    cp = scenario["constructor_prices"]
    d_floor = scenario["d_floor"]
    c_floor = scenario["c_floor"]

    print(f"\n{'─' * 80}")
    print(f"  {name}")
    print(f"{'─' * 80}")

    # ── 1. Price distribution ─────────────────────────────────────────
    all_d_prices = sorted(dp.values())
    all_c_prices = sorted(cp.values())
    at_d_floor = sum(1 for p in all_d_prices if p <= d_floor)
    at_c_floor = sum(1 for p in all_c_prices if p <= c_floor)
    above_10m_d = sum(1 for p in all_d_prices if p >= 10_000_000)
    above_10m_c = sum(1 for p in all_c_prices if p >= 10_000_000)

    print(f"\n  1. PRICE DISTRIBUTION")
    print(f"     Drivers:  {len(dp)} total, {at_d_floor} at floor ({fmt_m(d_floor)}), "
          f"{len(dp) - at_d_floor} differentiated, {above_10m_d} above $10M")
    print(f"     Constr.:  {len(cp)} total, {at_c_floor} at floor ({fmt_m(c_floor)}), "
          f"{len(cp) - at_c_floor} differentiated, {above_10m_c} above $10M")

    # Price range
    d_range = max(all_d_prices) - min(all_d_prices)
    c_range = max(all_c_prices) - min(all_c_prices)
    d_stdev = statistics.stdev(all_d_prices) if len(all_d_prices) > 1 else 0
    print(f"     Driver range: {fmt_m(min(all_d_prices))} – {fmt_m(max(all_d_prices))} "
          f"(spread: {fmt_m(d_range)}, σ: {fmt_m(int(d_stdev))})")
    print(f"     Constr. range: {fmt_m(min(all_c_prices))} – {fmt_m(max(all_c_prices))} "
          f"(spread: {fmt_m(c_range)})")

    # ── 2. Full price table with PPM ──────────────────────────────────
    print(f"\n  2. DRIVER PRICES & PPM (sorted by 2025 score)")
    print(f"     {'Driver':<6}  {'Price':>8}  {'2025 pts':>9}  {'PPM':>6}  {'Δ from floor':>13}")
    sorted_drivers = sorted(DRIVER_SCORES_2025.keys(), key=lambda d: -DRIVER_SCORES_2025[d])
    for d in sorted_drivers:
        if d not in dp:
            continue
        price = dp[d]
        score = DRIVER_SCORES_2025[d]
        p = ppm(score, price)
        delta = price - d_floor
        marker = " ◄ floor" if price <= d_floor else ""
        print(f"     {d:<6}  {fmt_m(price):>8}  {score:>9}  {p:>5.2f}  {fmt_m(delta):>13}{marker}")

    print(f"\n     {'Constr.':<22}  {'Price':>8}  {'2025 pts':>9}  {'PPM':>6}")
    sorted_constrs = sorted(CONSTRUCTOR_SCORES_2025.keys(), key=lambda c: -CONSTRUCTOR_SCORES_2025[c])
    for c in sorted_constrs:
        if c not in cp:
            continue
        price = cp[c]
        score = CONSTRUCTOR_SCORES_2025[c]
        p = ppm(score, price)
        marker = " ◄ floor" if price <= c_floor else ""
        print(f"     {c:<22}  {fmt_m(price):>8}  {score:>9}  {p:>5.2f}{marker}")

    # ── 3. Dream team cost & tightness ────────────────────────────────
    dt_d, dt_c, dt_cost = dream_team(dp, cp)
    print(f"\n  3. DREAM TEAM")
    print(f"     Drivers:  {', '.join(dt_d)}")
    print(f"     Constr.:  {', '.join(dt_c)}")
    print(f"     Cost:     {fmt_m(dt_cost)}")
    for cap in BUDGET_CAPS:
        tightness = dt_cost / cap * 100
        print(f"     @ {fmt_m(cap)} cap: {tightness:.1f}% tightness", end="")
        if 125 <= tightness <= 140:
            print("  ✓ in range")
        elif tightness < 125:
            print("  ✗ too loose")
        else:
            print("  ✗ too tight")

    # ── 4 & 5. Optimal teams at each budget cap ──────────────────────
    print(f"\n  4. OPTIMAL TEAMS BY BUDGET CAP")
    for cap in BUDGET_CAPS:
        result = best_affordable_team(dp, cp, cap)
        if result["feasible"] == 0:
            print(f"\n     @ {fmt_m(cap)}: NO FEASIBLE TEAMS")
            continue

        # Sort by score for display
        best_d = sorted(result["drivers"], key=lambda d: -DRIVER_SCORES_2025.get(d, 0))
        best_c = sorted(result["constructors"], key=lambda c: -CONSTRUCTOR_SCORES_2025.get(c, 0))
        overlap_total = result["dream_overlap_d"] + result["dream_overlap_c"]

        print(f"\n     @ {fmt_m(cap)} cap:")
        print(f"       Best team:     {', '.join(best_d)} + {', '.join(best_c)}")
        print(f"       Score:         {result['best_score']:,} pts")
        print(f"       Cost:          {fmt_m(result['cost'])}")
        print(f"       Dream overlap: {overlap_total}/8 ({result['dream_overlap_d']}/5 D, {result['dream_overlap_c']}/3 C)")
        print(f"       Feasible:      {result['feasible']:,} teams")
        print(f"       Within 80%:    {result['within_80pct']:,} teams")

        # Show price breakdown
        print(f"       Breakdown:")
        for d in best_d:
            p = dp[d]
            s = DRIVER_SCORES_2025.get(d, 0)
            pp = ppm(s, p)
            dream_marker = " ★" if d in dt_d else ""
            print(f"         {d:<6} {fmt_m(p):>8}  {s:>5} pts  {pp:.2f} PPM{dream_marker}")
        for c in best_c:
            p = cp[c]
            s = CONSTRUCTOR_SCORES_2025.get(c, 0)
            pp = ppm(s, p)
            dream_marker = " ★" if c in dt_c else ""
            print(f"         {c:<22} {fmt_m(p):>8}  {s:>5} pts  {pp:.2f} PPM{dream_marker}")

    # ── 6. Mispricing analysis ────────────────────────────────────────
    print(f"\n  5. MISPRICING ANALYSIS (preseason price vs actual 2025 value)")
    # For each driver, compare their preseason PPM prediction vs actual PPM
    # A "well-priced" driver has actual PPM close to the grid average
    ppms = []
    for d in sorted_drivers:
        if d not in dp:
            continue
        score = DRIVER_SCORES_2025[d]
        price = dp[d]
        if price > 0:
            ppms.append((d, score, price, ppm(score, price)))

    avg_ppm = statistics.mean(p for _, _, _, p in ppms)
    print(f"     Grid average PPM: {avg_ppm:.2f}")
    print(f"     {'Driver':<6}  {'Price':>8}  {'PPM':>6}  {'vs avg':>8}  Assessment")
    for d, score, price, p in ppms:
        diff = p - avg_ppm
        if abs(diff) < avg_ppm * 0.2:
            assessment = "fair"
        elif diff > 0:
            assessment = "UNDERPRICED" if diff > avg_ppm * 0.5 else "underpriced"
        else:
            assessment = "OVERPRICED" if diff < -avg_ppm * 0.5 else "overpriced"
        print(f"     {d:<6}  {fmt_m(price):>8}  {p:>5.2f}  {diff:>+7.2f}  {assessment}")

print(f"\n{'=' * 80}")
print("  COMPARISON COMPLETE")
print(f"{'=' * 80}")
