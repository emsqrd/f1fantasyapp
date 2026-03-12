"""
correction_speed_comparison.py — Compare in-season correction approaches.

All scenarios use constructor-context preseason pricing (α=0.5).

Tests:
  A) Current: frozen 3 races, 3-race rolling window, ±10% cap
  B) Fast (from model_comparison): no freeze, expanding window 1→2→3, ±10% cap
  C) Frozen 1: first correction after R2, min 2-race window, ±10% cap
  D) Frozen 1 + dampened: same as C but ±5% cap when window < 3

Measures:
  - Per-round total grid mispricing (sum of |price - fair| for all drivers)
  - Price path for key mispriced drivers
  - Price stability (average absolute round-over-round change)
"""

import csv
import statistics
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
TOTAL_RACES = 24

# Power curve parameters
DRIVER_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_FLOOR = 6_000_000
CONSTRUCTOR_CEILING = 25_000_000
SHAPE = 1.0
DRIVER_REF_MAX = 29.29
CONSTRUCTOR_REF_MAX = 35.33


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg: float | None, entity_type: str) -> int:
    floor = DRIVER_FLOOR if entity_type == "driver" else CONSTRUCTOR_FLOOR
    ceiling = DRIVER_CEILING if entity_type == "driver" else CONSTRUCTOR_CEILING
    ref_max = DRIVER_REF_MAX if entity_type == "driver" else CONSTRUCTOR_REF_MAX
    if avg is None or avg <= 0:
        return floor
    norm = max(0.0, min(1.0, avg / ref_max))
    return max(floor, round_100k(floor + (ceiling - floor) * norm ** SHAPE))


def fmt_m(x: int) -> str:
    return f"${x / 1e6:.1f}M"


# ── Load data ────────────────────────────────────────────────────────────

DRIVER_AVG_2024: dict[str, float | None] = {}
CONSTRUCTOR_AVG_2024: dict[str, float | None] = {}
with open(OUTPUT_DIR / "pricing/preseason_prices_2025.csv") as f:
    for row in csv.DictReader(f):
        avg_str = row["avg_2024"]
        if row["type"] == "driver":
            DRIVER_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)
        else:
            CONSTRUCTOR_AVG_2024[row["entity"]] = None if avg_str == "rookie" else float(avg_str)

DRIVER_SCORES: dict[str, int] = {}
DRIVER_TEAMS_2025: dict[str, str] = {}
with open(OUTPUT_DIR / "2025/season_totals.csv") as f:
    for row in csv.DictReader(f):
        DRIVER_SCORES[row["driver"]] = int(row["season_total"])
        DRIVER_TEAMS_2025[row["driver"]] = row["team"]

RACE_SCORES: dict[str, list[int]] = {}
with open(OUTPUT_DIR / "2025/driver_scores.csv") as f:
    for row in csv.DictReader(f):
        driver = row["driver"]
        rnd = int(row["round"])
        pts = int(row["total_pts"])
        if driver not in RACE_SCORES:
            RACE_SCORES[driver] = []
        while len(RACE_SCORES[driver]) < rnd:
            RACE_SCORES[driver].append(0)
        RACE_SCORES[driver][rnd - 1] = pts

# ── Constructor-context preseason prices (α=0.5) ─────────────────────────

CONSTRUCTOR_PER_DRIVER_AVG: dict[str, float] = {}
for name, avg in CONSTRUCTOR_AVG_2024.items():
    if avg is not None:
        CONSTRUCTOR_PER_DRIVER_AVG[name] = avg / 2.0

TEAM_2024: dict[str, str | None] = {
    "VER": "Red Bull Racing", "NOR": "McLaren", "LEC": "Ferrari",
    "PIA": "McLaren", "SAI": "Ferrari", "RUS": "Mercedes",
    "HAM": "Mercedes", "ALO": "Aston Martin", "GAS": "Alpine",
    "HUL": "Haas F1 Team", "OCO": "Alpine", "TSU": "Racing Bulls",
    "STR": "Aston Martin", "ALB": "Williams",
    "COL": "Williams", "LAW": "Racing Bulls", "BEA": "Haas F1 Team",
    "BOR": None, "HAD": None, "DOO": "Alpine", "ANT": None,
}

IS_ROOKIE = {d: DRIVER_AVG_2024[d] is None for d in DRIVER_AVG_2024}
CHANGED_TEAM = {}
for d in DRIVER_AVG_2024:
    if IS_ROOKIE[d]:
        CHANGED_TEAM[d] = False
    else:
        old = TEAM_2024.get(d)
        new = DRIVER_TEAMS_2025.get(d)
        CHANGED_TEAM[d] = old is not None and new is not None and old != new

ALPHA = 0.5
PRESEASON_PRICES: dict[str, int] = {}
for driver in DRIVER_AVG_2024:
    new_team = DRIVER_TEAMS_2025.get(driver)
    team_avg = CONSTRUCTOR_PER_DRIVER_AVG.get(new_team, 0) if new_team else 0
    if IS_ROOKIE[driver]:
        PRESEASON_PRICES[driver] = power_curve_price(max(0, team_avg), "driver")
    elif CHANGED_TEAM[driver]:
        individual = DRIVER_AVG_2024[driver]
        adj = ALPHA * individual + (1 - ALPHA) * team_avg
        PRESEASON_PRICES[driver] = power_curve_price(max(0, adj), "driver")
    else:
        PRESEASON_PRICES[driver] = power_curve_price(DRIVER_AVG_2024[driver], "driver")

FAIR_PRICES = {d: power_curve_price(DRIVER_SCORES[d] / TOTAL_RACES, "driver") for d in DRIVER_SCORES}


# ── Correction scenarios ─────────────────────────────────────────────────

def simulate_correction(
    label: str,
    frozen_rounds: int,
    min_window: int,
    max_window: int,
    cap_fraction: float,
    early_cap_fraction: float | None = None,
    early_cap_until: int = 0,
) -> dict[str, list[int]]:
    """
    Simulate price evolution for the first 10 races.

    frozen_rounds: rounds with no price changes
    min_window: minimum rolling window size before corrections start
    max_window: maximum rolling window size
    cap_fraction: max price change per round as fraction of current price
    early_cap_fraction: if set, use this cap instead for rounds <= early_cap_until
    early_cap_until: last round to use early_cap_fraction
    """
    price_history: dict[str, list[int]] = {}

    for driver in DRIVER_AVG_2024:
        current = PRESEASON_PRICES[driver]
        history = [current]
        scores = RACE_SCORES.get(driver, [])

        for rnd in range(1, 11):  # rounds 1-10
            if rnd <= frozen_rounds:
                history.append(current)
                continue

            # Window size: expand from min_window to max_window
            window = min(rnd, max_window)
            if window < min_window:
                history.append(current)
                continue

            recent = scores[max(0, rnd - window):rnd]
            if len(recent) < min_window:
                history.append(current)
                continue

            rolling_avg = sum(recent) / len(recent)
            target = power_curve_price(rolling_avg, "driver")
            raw_delta = target - current

            # Choose cap fraction
            if early_cap_fraction is not None and rnd <= early_cap_until:
                frac = early_cap_fraction
            else:
                frac = cap_fraction

            cap = max(100_000, round_100k(current * frac))
            delta = max(-cap, min(cap, raw_delta))
            current = max(DRIVER_FLOOR, round_100k(current + delta))
            history.append(current)

        price_history[driver] = history

    return price_history


scenarios = [
    {
        "label": "A) Frozen 3, window 3, ±10%  (current)",
        "frozen_rounds": 3, "min_window": 3, "max_window": 3,
        "cap_fraction": 0.10,
    },
    {
        "label": "B) No freeze, expanding 1→3, ±10%  (fast)",
        "frozen_rounds": 0, "min_window": 1, "max_window": 3,
        "cap_fraction": 0.10,
    },
    {
        "label": "C) Frozen 1, min window 2→3, ±10%",
        "frozen_rounds": 1, "min_window": 2, "max_window": 3,
        "cap_fraction": 0.10,
    },
    {
        "label": "D) Frozen 1, min window 2→3, ±5% early / ±10% after R3",
        "frozen_rounds": 1, "min_window": 2, "max_window": 3,
        "cap_fraction": 0.10,
        "early_cap_fraction": 0.05,
        "early_cap_until": 3,
    },
    {
        "label": "E) Frozen 2, window 2→3, ±10%",
        "frozen_rounds": 2, "min_window": 2, "max_window": 3,
        "cap_fraction": 0.10,
    },
]

KEY_DRIVERS = ["ANT", "SAI", "TSU", "BEA", "HAD", "HAM"]

print("=" * 90)
print("  CORRECTION SPEED COMPARISON")
print("  All scenarios use constructor-context preseason pricing (α=0.5)")
print("=" * 90)

all_results = {}
for scenario in scenarios:
    label = scenario["label"]
    history = simulate_correction(**{k: v for k, v in scenario.items()})
    all_results[label] = history

    print(f"\n  ── {label}")

    # Price paths for key drivers
    print(f"  {'Driver':<6} {'Fair':>7} {'Pre':>7}", end="")
    for r in range(1, 11):
        print(f" {'R'+str(r):>7}", end="")
    print()

    for driver in KEY_DRIVERS:
        h = history[driver]
        fair = FAIR_PRICES.get(driver, DRIVER_FLOOR)
        row = f"  {driver:<6} {fmt_m(fair):>7} {fmt_m(h[0]):>7}"
        for r in range(1, 11):
            price = h[r]
            # Mark direction: ↑ rising toward fair, ↓ moving away
            diff_from_fair = abs(price - fair)
            prev_diff = abs(h[r-1] - fair)
            if price == h[r-1]:
                marker = " "
            elif diff_from_fair < prev_diff:
                marker = "→"  # converging
            else:
                marker = "←"  # diverging
            row += f" {fmt_m(price):>6}{marker}"
        print(row)

    # Total grid mispricing per round
    print(f"\n  Grid mispricing ($M):", end="")
    print(f"  Pre", end="")
    for r in range(1, 11):
        print(f"   R{r:>2}", end="")
    print()
    print(f"  {'':>22}", end="")

    mispr = []
    for r in range(0, 11):
        total = sum(abs(history[d][r] - FAIR_PRICES.get(d, DRIVER_FLOOR))
                    for d in DRIVER_AVG_2024 if d in FAIR_PRICES) / 1e6
        mispr.append(total)
        print(f" {total:>5.1f}", end="")
    print()

    # Price stability (avg absolute round-over-round change across all drivers)
    changes = []
    for d in DRIVER_AVG_2024:
        h = history[d]
        for r in range(1, 11):
            changes.append(abs(h[r] - h[r-1]))
    avg_change = statistics.mean(changes) / 1e6
    max_change = max(changes) / 1e6
    print(f"  Avg round-to-round change: {fmt_m(int(statistics.mean(changes)))}")
    print(f"  Max single change:         {fmt_m(int(max(changes)))}")


# ══════════════════════════════════════════════════════════════════════════
# SUMMARY TABLE
# ══════════════════════════════════════════════════════════════════════════

print(f"\n{'=' * 90}")
print(f"  SUMMARY: TOTAL GRID MISPRICING ($M) BY ROUND")
print(f"{'=' * 90}")

print(f"\n  {'Scenario':<55} {'Pre':>5}", end="")
for r in range(1, 9):
    print(f" {'R'+str(r):>5}", end="")
print(f" {'Avg':>6}")

for label, history in all_results.items():
    short = label.split(")")[0] + ")" + label.split(")")[1][:30]
    mispr = []
    for r in range(0, 9):
        total = sum(abs(history[d][r] - FAIR_PRICES.get(d, DRIVER_FLOOR))
                    for d in DRIVER_AVG_2024 if d in FAIR_PRICES) / 1e6
        mispr.append(total)
    avg_mispr = statistics.mean(mispr[1:])  # avg of R1-R8 (exclude preseason)
    print(f"  {short:<55} {mispr[0]:>5.1f}", end="")
    for r in range(1, 9):
        print(f" {mispr[r]:>5.1f}", end="")
    print(f" {avg_mispr:>5.1f}")

# Stability summary
print(f"\n  {'Scenario':<55} {'Avg Δ':>8} {'Max Δ':>8}")
for label, history in all_results.items():
    short = label.split(")")[0] + ")" + label.split(")")[1][:30]
    changes = []
    for d in DRIVER_AVG_2024:
        h = history[d]
        for r in range(1, 9):
            changes.append(abs(h[r] - h[r-1]))
    print(f"  {short:<55} {fmt_m(int(statistics.mean(changes))):>8} {fmt_m(int(max(changes))):>8}")

print(f"\n{'=' * 90}")
