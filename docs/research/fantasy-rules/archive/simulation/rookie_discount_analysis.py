"""
rookie_discount_analysis.py — Explore explicit rookie discounts to constructor-context pricing.

Current model: rookies are priced at their new team's per-driver avg.
Question: should we apply a discount factor (e.g., 0.7-0.9) to that avg?

Approach:
  1. Identify all rookies across season transitions (2022→2023, 2023→2024, 2024→2025)
  2. For each rookie, compute: team per-driver avg, actual performance, model prices at
     various discount factors
  3. Measure mispricing reduction (if any) across discount levels
  4. Project impact on 2026 grid (Lindblad at Racing Bulls)

A rookie is defined as a driver with < MIN_RACES_ELIGIBLE (10) races in the prior season.
"""

import csv
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"

# ── Model parameters ────────────────────────────────────────────────────

DRIVER_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
SHAPE = 1.0
DRIVER_REF_MAX = 29.29
CONSTRUCTOR_REF_MAX = 45.25
MIN_RACES_ELIGIBLE = 10
TOTAL_RACES_22_23 = 22
TOTAL_RACES_24_25 = 24


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg: float | None, ref_max: float = DRIVER_REF_MAX) -> int:
    if avg is None or avg <= 0:
        return DRIVER_FLOOR
    norm = max(0.0, min(1.0, avg / ref_max))
    return max(DRIVER_FLOOR, round_100k(DRIVER_FLOOR + (DRIVER_CEILING - DRIVER_FLOOR) * norm ** SHAPE))


def fmt_m(x: int) -> str:
    return f"${x / 1e6:.1f}M"


# ── Load all season data ────────────────────────────────────────────────


def load_season(year: int) -> tuple[dict, dict]:
    """Returns (driver_data, constructor_data) for a season."""
    total_races = TOTAL_RACES_22_23 if year <= 2023 else TOTAL_RACES_24_25

    drivers = {}  # {code: {team, total, races, per_race_avg}}
    with open(OUTPUT_DIR / f"{year}/season_totals.csv") as f:
        for row in csv.DictReader(f):
            code = row["driver"]
            races = int(row["races_entered"])
            total = int(row["season_total"])
            drivers[code] = {
                "team": row["team"],
                "total": total,
                "races": races,
                "per_race_avg": total / races if races >= MIN_RACES_ELIGIBLE else None,
            }

    constructors = {}  # {name: {total, per_driver_avg}}
    with open(OUTPUT_DIR / f"{year}/season_constructor_totals.csv") as f:
        for row in csv.DictReader(f):
            name = row["constructor"]
            total = int(row["season_total"])
            constructors[name] = {
                "total": total,
                "per_driver_avg": total / 2.0 / total_races,  # approx per-driver per-race
            }

    return drivers, constructors


# ── Identify rookies for each season transition ─────────────────────────

# Known grid for each season start (driver → team they RACED for that year)
# Only including drivers relevant to rookie analysis
GRID_2023 = {
    "VER": "Red Bull Racing", "PER": "Red Bull Racing",
    "HAM": "Mercedes", "RUS": "Mercedes",
    "LEC": "Ferrari", "SAI": "Ferrari",
    "NOR": "McLaren", "PIA": "McLaren",  # PIA rookie
    "ALO": "Aston Martin", "STR": "Aston Martin",
    "OCO": "Alpine", "GAS": "Alpine",
    "BOT": "Alfa Romeo", "ZHO": "Alfa Romeo",
    "MAG": "Haas F1 Team", "HUL": "Haas F1 Team",  # HUL returning (<10 races 2022)
    "TSU": "AlphaTauri", "DEV": "AlphaTauri",  # DEV rookie-ish (1 race 2022)
    "ALB": "Williams", "SAR": "Williams",  # SAR rookie
}

GRID_2024 = {
    "VER": "Red Bull Racing", "PER": "Red Bull Racing",
    "HAM": "Mercedes", "RUS": "Mercedes",
    "LEC": "Ferrari", "SAI": "Ferrari",
    "NOR": "McLaren", "PIA": "McLaren",
    "ALO": "Aston Martin", "STR": "Aston Martin",
    "OCO": "Alpine", "GAS": "Alpine",
    "BOT": "Kick Sauber", "ZHO": "Kick Sauber",
    "MAG": "Haas F1 Team", "HUL": "Haas F1 Team",
    "TSU": "RB", "RIC": "RB",
    "ALB": "Williams", "SAR": "Williams",
}

GRID_2025 = {
    "VER": "Red Bull Racing", "TSU": "Red Bull Racing",
    "NOR": "McLaren", "PIA": "McLaren",
    "RUS": "Mercedes", "ANT": "Mercedes",  # ANT rookie
    "LEC": "Ferrari", "HAM": "Ferrari",
    "SAI": "Williams", "ALB": "Williams",
    "ALO": "Aston Martin", "STR": "Aston Martin",
    "HUL": "Kick Sauber", "BOR": "Kick Sauber",  # BOR rookie
    "OCO": "Haas F1 Team", "BEA": "Haas F1 Team",  # BEA rookie-ish
    "GAS": "Alpine", "DOO": "Alpine",  # DOO replaced by COL mid-season
    "LAW": "Racing Bulls", "HAD": "Racing Bulls",  # HAD rookie
}


def find_rookies(prior_year_drivers: dict, current_grid: dict) -> list[dict]:
    """Find drivers in current_grid who are rookies (no/insufficient prior year data)."""
    rookies = []
    for code, team in current_grid.items():
        prior = prior_year_drivers.get(code)
        if prior is None or prior["races"] < MIN_RACES_ELIGIBLE:
            rookies.append({
                "code": code,
                "team": team,
                "prior_races": prior["races"] if prior else 0,
                "prior_avg": prior["per_race_avg"] if prior else None,
            })
    return rookies


# ── Run the analysis ────────────────────────────────────────────────────

seasons = {
    2022: load_season(2022),
    2023: load_season(2023),
    2024: load_season(2024),
    2025: load_season(2025),
}

DISCOUNT_FACTORS = [1.0, 0.90, 0.80, 0.75, 0.70, 0.60, 0.50]

transitions = [
    ("2022→2023", 2022, 2023, GRID_2023),
    ("2023→2024", 2023, 2024, GRID_2024),
    ("2024→2025", 2024, 2025, GRID_2025),
]

all_rookies = []  # collect for cross-season summary

print("=" * 100)
print("  ROOKIE DISCOUNT ANALYSIS")
print("=" * 100)

for label, prior_yr, curr_yr, grid in transitions:
    prior_drivers, prior_constructors = seasons[prior_yr]
    curr_drivers, curr_constructors = seasons[curr_yr]

    rookies = find_rookies(prior_drivers, grid)
    if not rookies:
        continue

    total_races = TOTAL_RACES_22_23 if curr_yr <= 2023 else TOTAL_RACES_24_25

    # Constructor name mapping (team names may differ between seasons)
    # Use current season's constructor data for team per-driver avg
    # But we need prior season's constructor data for preseason pricing
    # The team per-driver avg comes from PRIOR season's constructor avg / 2
    CONSTRUCTOR_NAME_MAP = {
        "RB": "RB",
        "AlphaTauri": "AlphaTauri",
        "Alfa Romeo": "Alfa Romeo",
        "Kick Sauber": "Kick Sauber",
    }

    print(f"\n{'─' * 100}")
    print(f"  {label} — {len(rookies)} rookies")
    print(f"{'─' * 100}")

    # Header
    header = f"  {'Driver':<6} {'Team':<20} {'Team avg':>9} {'Actual':>8} {'Ratio':>7} {'Fair':>8}"
    for df in DISCOUNT_FACTORS:
        lbl = "No disc" if df == 1.0 else f"d={df:.0%}"
        header += f" {lbl:>8}"
    print(header)
    print(f"  {'─' * (len(header) - 2)}")

    for rookie in rookies:
        code = rookie["code"]
        team = rookie["team"]

        # Find team per-driver avg from prior season constructors
        # Need to handle team name mismatches
        team_constructor = None
        for cname in prior_constructors:
            # Try exact match first, then check if it's the same physical team
            if cname == team:
                team_constructor = cname
                break
        # Fallback mappings for name changes
        if team_constructor is None:
            name_map = {
                "Haas F1 Team": "Haas F1 Team",
                "Kick Sauber": "Alfa Romeo",  # 2022→2023
                "RB": "AlphaTauri",  # 2023→2024
            }
            if team in name_map and name_map[team] in prior_constructors:
                team_constructor = name_map[team]

        if team_constructor is None:
            # Try substring match
            for cname in prior_constructors:
                if team in cname or cname in team:
                    team_constructor = cname
                    break

        if team_constructor:
            team_per_driver_avg = prior_constructors[team_constructor]["per_driver_avg"]
        else:
            team_per_driver_avg = 0.0

        # Actual performance in current season
        actual_data = curr_drivers.get(code)
        if actual_data and actual_data["races"] >= MIN_RACES_ELIGIBLE:
            actual_per_race = actual_data["total"] / actual_data["races"]
            actual_total = actual_data["total"]
        elif actual_data:
            actual_per_race = actual_data["total"] / actual_data["races"]
            actual_total = actual_data["total"]
        else:
            actual_per_race = 0
            actual_total = 0

        fair_price = power_curve_price(actual_per_race)

        # Ratio of actual vs team avg
        ratio = actual_per_race / team_per_driver_avg if team_per_driver_avg > 0 else float("inf")

        row = f"  {code:<6} {team:<20} {team_per_driver_avg:>8.2f} {actual_per_race:>7.2f} {ratio:>6.0%} {fmt_m(fair_price):>8}"

        rookie_results = {"code": code, "team": team, "year": curr_yr,
                         "team_avg": team_per_driver_avg, "actual_avg": actual_per_race,
                         "ratio": ratio, "fair_price": fair_price,
                         "actual_total": actual_total}

        for df in DISCOUNT_FACTORS:
            discounted_avg = team_per_driver_avg * df
            price = power_curve_price(discounted_avg)
            misprice = abs(price - fair_price)
            row += f" {fmt_m(price):>8}"

        print(row)

        all_rookies.append(rookie_results)

# ══════════════════════════════════════════════════════════════════════════
# CROSS-SEASON SUMMARY: Which discount minimizes total mispricing?
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 100}")
print("  CROSS-SEASON MISPRICING BY DISCOUNT FACTOR")
print(f"{'=' * 100}")

print(f"\n  Individual rookie mispricing (|model price - fair price|):")
header = f"  {'Driver':<6} {'Year':>5} {'Team':<20} {'Fair':>8}"
for df in DISCOUNT_FACTORS:
    lbl = "No disc" if df == 1.0 else f"d={df:.0%}"
    header += f" {lbl:>8}"
header += f" {'Best':>8}"
print(header)
print(f"  {'─' * (len(header) - 2)}")

# Track totals
total_misprice = {df: 0 for df in DISCOUNT_FACTORS}
# Track only "meaningful" rookies (team avg above floor threshold)
meaningful_rookies = []
MEANINGFUL_THRESHOLD = 4.0  # team per-driver avg above this → discount matters

for r in all_rookies:
    fair = r["fair_price"]
    row = f"  {r['code']:<6} {r['year']:>5} {r['team']:<20} {fmt_m(fair):>8}"

    best_df = None
    best_misprice = float("inf")

    for df in DISCOUNT_FACTORS:
        discounted_avg = r["team_avg"] * df
        price = power_curve_price(discounted_avg)
        misprice = abs(price - fair)
        total_misprice[df] += misprice
        row += f" {fmt_m(misprice):>8}"
        if misprice < best_misprice:
            best_misprice = misprice
            best_df = df

    best_label = "No disc" if best_df == 1.0 else f"d={best_df:.0%}"
    row += f" {best_label:>8}"
    print(row)

    if r["team_avg"] > MEANINGFUL_THRESHOLD:
        meaningful_rookies.append(r)

print(f"\n  TOTALS (all {len(all_rookies)} rookies):")
header = f"  {'Metric':<25}"
for df in DISCOUNT_FACTORS:
    lbl = "No disc" if df == 1.0 else f"d={df:.0%}"
    header += f" {lbl:>8}"
print(header)
row = f"  {'Total mispricing':<25}"
for df in DISCOUNT_FACTORS:
    row += f" {fmt_m(total_misprice[df]):>8}"
print(row)
row = f"  {'Avg mispricing/rookie':<25}"
n = len(all_rookies)
for df in DISCOUNT_FACTORS:
    row += f" {fmt_m(total_misprice[df] // n):>8}"
print(row)

# Meaningful rookies only (where discount actually changes the price)
if meaningful_rookies:
    print(f"\n  MEANINGFUL ROOKIES ONLY (team avg > ${MEANINGFUL_THRESHOLD}M per-driver, where discount actually matters):")
    meaningful_misprice = {df: 0 for df in DISCOUNT_FACTORS}
    for r in meaningful_rookies:
        for df in DISCOUNT_FACTORS:
            discounted_avg = r["team_avg"] * df
            price = power_curve_price(discounted_avg)
            meaningful_misprice[df] += abs(price - r["fair_price"])

    header = f"  {'':>6} {'Year':>5} {'Team':<20} {'Team avg':>9} {'Actual':>8} {'Ratio':>7}"
    print(header)
    for r in meaningful_rookies:
        print(f"  {r['code']:<6} {r['year']:>5} {r['team']:<20} {r['team_avg']:>8.2f} {r['actual_avg']:>7.2f} {r['ratio']:>6.0%}")

    print()
    header = f"  {'Metric':<25}"
    for df in DISCOUNT_FACTORS:
        lbl = "No disc" if df == 1.0 else f"d={df:.0%}"
        header += f" {lbl:>8}"
    print(header)
    row = f"  {'Total mispricing':<25}"
    for df in DISCOUNT_FACTORS:
        row += f" {fmt_m(meaningful_misprice[df]):>8}"
    print(row)

# ══════════════════════════════════════════════════════════════════════════
# RATIO ANALYSIS: How do rookies perform relative to their team context?
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 100}")
print("  ROOKIE PERFORMANCE RATIO (actual / team per-driver avg)")
print(f"{'=' * 100}")

ratios = []
for r in all_rookies:
    if r["team_avg"] > 0:
        ratios.append(r["ratio"])
        tier = "TOP" if r["team_avg"] > 10 else ("MID" if r["team_avg"] > 3 else "BACK")
        print(f"  {r['code']:<6} {r['year']:>5}  {r['team']:<20}  avg={r['team_avg']:>6.2f}  actual={r['actual_avg']:>6.2f}  ratio={r['ratio']:>5.0%}  [{tier}]")

if ratios:
    import statistics
    print(f"\n  Mean ratio:   {statistics.mean(ratios):.0%}")
    print(f"  Median ratio: {statistics.median(ratios):.0%}")
    print(f"  Std dev:      {statistics.stdev(ratios):.0%}")
    print(f"  Min:          {min(ratios):.0%}")
    print(f"  Max:          {max(ratios):.0%}")

    # Separate by tier
    top_ratios = [r["ratio"] for r in all_rookies if r["team_avg"] > 10]
    mid_ratios = [r["ratio"] for r in all_rookies if 3 < r["team_avg"] <= 10]
    back_ratios = [r["ratio"] for r in all_rookies if 0 < r["team_avg"] <= 3]

    if top_ratios:
        print(f"\n  TOP teams (avg > 10):  n={len(top_ratios)}  mean={statistics.mean(top_ratios):.0%}  {'cases: ' + ', '.join(r['code'] for r in all_rookies if r['team_avg'] > 10)}")
    if mid_ratios:
        print(f"  MID teams (3 < avg ≤ 10): n={len(mid_ratios)}  mean={statistics.mean(mid_ratios):.0%}  {'cases: ' + ', '.join(r['code'] for r in all_rookies if 3 < r['team_avg'] <= 10)}")
    if back_ratios:
        print(f"  BACK teams (avg ≤ 3):  n={len(back_ratios)}  mean={statistics.mean(back_ratios):.0%}  {'cases: ' + ', '.join(r['code'] for r in all_rookies if 0 < r['team_avg'] <= 3)}")


# ══════════════════════════════════════════════════════════════════════════
# 2026 PROJECTION: Lindblad at Racing Bulls
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 100}")
print("  2026 PROJECTION: LINDBLAD AT RACING BULLS")
print(f"{'=' * 100}")

# Racing Bulls 2025 constructor total
rb_2025 = seasons[2025][1].get("Racing Bulls", {})
rb_total = rb_2025.get("total", 169)
rb_per_driver_avg = rb_2025.get("per_driver_avg", 169 / 48)

print(f"\n  Racing Bulls 2025: {rb_total} pts total, {rb_per_driver_avg:.2f} per-driver per-race avg")
print(f"\n  Lindblad preseason price at various discount factors:")

header = f"  {'Discount':<12} {'Adj avg':>8} {'Price':>10} {'vs no disc':>10}"
print(header)
no_disc_price = power_curve_price(rb_per_driver_avg)
for df in DISCOUNT_FACTORS:
    adj = rb_per_driver_avg * df
    price = power_curve_price(adj)
    delta = price - no_disc_price
    delta_str = f"{fmt_m(delta)}" if delta != 0 else "—"
    lbl = "No discount" if df == 1.0 else f"{df:.0%}"
    print(f"  {lbl:<12} {adj:>7.2f} {fmt_m(price):>10} {delta_str:>10}")

# Also show Perez and Bottas at Cadillac (new team, no prior data → floor)
print(f"\n  Note: PER and BOT at Cadillac (new team) → floor ${DRIVER_FLOOR / 1e6:.0f}M regardless of discount")

# ══════════════════════════════════════════════════════════════════════════
# EARLY-SEASON CORRECTION IMPACT
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 100}")
print("  EARLY-SEASON CORRECTION: DOES DISCOUNT HELP CONVERGENCE?")
print(f"{'=' * 100}")

# For ANT (the most interesting case), simulate price correction R1-R8
# with and without rookie discount, using dummy seeding
PRICE_CHANGE_CAP = 0.10
ROLLING_WINDOW = 3

# Load ANT's race-by-race scores
ant_scores = []
with open(OUTPUT_DIR / "2025/driver_scores.csv") as f:
    for row in csv.DictReader(f):
        if row["driver"] == "ANT":
            rnd = int(row["round"])
            pts = int(row["total_pts"])
            while len(ant_scores) < rnd:
                ant_scores.append(0)
            ant_scores[rnd - 1] = pts

ant_fair = power_curve_price(260 / 24)  # ANT's actual per-race avg
ant_team_avg = seasons[2024][1]["Mercedes"]["per_driver_avg"]

print(f"\n  ANT at Mercedes — team per-driver avg: {ant_team_avg:.2f}, actual per-race: {260/24:.2f}")
print(f"  Fair price: {fmt_m(ant_fair)}")

print(f"\n  Price evolution R0-R8 with dummy seeding:")
header = f"  {'Discount':<12} {'Pre':>8}"
for r in range(1, 9):
    header += f" {'R'+str(r):>8}"
header += f" {'R8 gap':>8}"
print(header)

for df in DISCOUNT_FACTORS:
    adj_avg = ant_team_avg * df
    preseason_price = power_curve_price(adj_avg)
    preseason_avg = adj_avg  # for dummy seeding

    # Dummy seeding: 2 dummy entries + real scores
    current = preseason_price
    row = f"  {'No disc' if df == 1.0 else f'd={df:.0%}':<12} {fmt_m(current):>8}"

    for rnd in range(1, 9):
        # Build window: dummy entries for missing slots
        if rnd == 1:
            window_scores = [preseason_avg, preseason_avg, ant_scores[0]]
        elif rnd == 2:
            window_scores = [preseason_avg, ant_scores[0], ant_scores[1]]
        else:
            window_scores = ant_scores[rnd - 3:rnd]

        rolling_avg = sum(window_scores) / len(window_scores)
        target = power_curve_price(rolling_avg)
        raw_delta = target - current
        cap = max(100_000, round_100k(current * PRICE_CHANGE_CAP))
        delta = max(-cap, min(cap, raw_delta))
        current = max(DRIVER_FLOOR, round_100k(current + delta))
        row += f" {fmt_m(current):>8}"

    r8_gap = abs(current - ant_fair)
    row += f" {fmt_m(r8_gap):>8}"
    print(row)


print(f"\n{'=' * 100}")
print("  ANALYSIS COMPLETE")
print(f"{'=' * 100}")
