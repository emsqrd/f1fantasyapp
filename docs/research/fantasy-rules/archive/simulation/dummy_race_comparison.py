"""
dummy_race_comparison.py — Compare dummy-race seeding vs frozen period.

All scenarios use constructor-context preseason pricing (α=0.5).

The dummy race approach:
  - Seed the 3-race rolling window with 2 "dummy" entries equal to the
    driver's preseason per-race average (the value used to compute their price)
  - After R1: window = [dummy, dummy, R1]
  - After R2: window = [dummy, R1, R2]
  - After R3+: window = [R(n-2), R(n-1), Rn]  — fully real data
  - No frozen period, 3-race window always, same volatility all season

Compared against:
  A) Current: frozen 3, 3-race window, ±10% cap
  E) Frozen 2: 2-race min window then 3, ±10% cap
  F) Dummy races: 2 dummy entries, 3-race window always, ±10% cap
"""

import csv
import statistics
from pathlib import Path

SIM_DIR = Path(__file__).parent
OUTPUT_DIR = SIM_DIR / "output"
TOTAL_RACES = 24
WINDOW = 3

DRIVER_FLOOR = 6_000_000
DRIVER_CEILING = 19_000_000
CONSTRUCTOR_FLOOR = 6_000_000
CONSTRUCTOR_CEILING = 25_000_000
SHAPE = 1.0
DRIVER_REF_MAX = 29.29
CONSTRUCTOR_REF_MAX = 45.25
BUDGET_CAP = 100_000_000
PRICE_CHANGE_CAP = 0.10


def round_100k(x: float) -> int:
    return round(x / 100_000) * 100_000


def power_curve_price(avg, entity_type: str) -> int:
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

TEAM_2024 = {
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

# Compute both preseason prices AND the per-race avg used to derive them
# (the per-race avg becomes the dummy race score)
PRESEASON_PRICES: dict[str, int] = {}
PRESEASON_AVG: dict[str, float] = {}  # the avg used for pricing → dummy score

for driver in DRIVER_AVG_2024:
    new_team = DRIVER_TEAMS_2025.get(driver)
    team_avg = CONSTRUCTOR_PER_DRIVER_AVG.get(new_team, 0) if new_team else 0

    if IS_ROOKIE[driver]:
        adj = max(0, team_avg)
    elif CHANGED_TEAM[driver]:
        individual = DRIVER_AVG_2024[driver]
        adj = max(0, ALPHA * individual + (1 - ALPHA) * team_avg)
    else:
        adj = DRIVER_AVG_2024[driver] if DRIVER_AVG_2024[driver] else 0

    PRESEASON_PRICES[driver] = power_curve_price(adj, "driver")
    PRESEASON_AVG[driver] = adj

FAIR_PRICES = {d: power_curve_price(DRIVER_SCORES[d] / TOTAL_RACES, "driver")
               for d in DRIVER_SCORES}


# ── Simulation ───────────────────────────────────────────────────────────

def simulate_frozen(frozen_rounds: int, min_window: int) -> dict[str, list[int]]:
    """Current approach: frozen period, then rolling window."""
    history: dict[str, list[int]] = {}
    for driver in DRIVER_AVG_2024:
        current = PRESEASON_PRICES[driver]
        h = [current]
        scores = RACE_SCORES.get(driver, [])
        for rnd in range(1, TOTAL_RACES + 1):
            if rnd <= frozen_rounds:
                h.append(current)
                continue
            window = min(rnd, WINDOW)
            if window < min_window:
                h.append(current)
                continue
            recent = scores[max(0, rnd - window):rnd]
            if len(recent) < min_window:
                h.append(current)
                continue
            rolling = sum(recent) / len(recent)
            target = power_curve_price(rolling, "driver")
            cap = max(100_000, round_100k(current * PRICE_CHANGE_CAP))
            delta = max(-cap, min(cap, target - current))
            current = max(DRIVER_FLOOR, round_100k(current + delta))
            h.append(current)
        history[driver] = h
    return history


def simulate_dummy_races() -> dict[str, list[int]]:
    """Dummy race approach: seed window with 2 preseason-avg entries."""
    history: dict[str, list[int]] = {}
    for driver in DRIVER_AVG_2024:
        current = PRESEASON_PRICES[driver]
        h = [current]
        scores = RACE_SCORES.get(driver, [])
        dummy = PRESEASON_AVG[driver]

        for rnd in range(1, TOTAL_RACES + 1):
            # Build the 3-entry window: [oldest, middle, newest]
            # Before R1: [dummy, dummy, dummy] (not used, just preseason)
            # After R1:  [dummy, dummy, R1]
            # After R2:  [dummy, R1, R2]
            # After R3+: [R(n-2), R(n-1), Rn]
            entries = []
            for i in range(WINDOW):
                race_idx = rnd - WINDOW + i  # 0-indexed race
                if race_idx < 0:
                    entries.append(dummy)
                else:
                    entries.append(scores[race_idx] if race_idx < len(scores) else 0)

            rolling = sum(entries) / len(entries)
            target = power_curve_price(rolling, "driver")
            cap = max(100_000, round_100k(current * PRICE_CHANGE_CAP))
            delta = max(-cap, min(cap, target - current))
            current = max(DRIVER_FLOOR, round_100k(current + delta))
            h.append(current)

        history[driver] = h
    return history


# ── Run scenarios ────────────────────────────────────────────────────────

scenarios = {
    "A) Frozen 3, window 3 (current)": simulate_frozen(3, 3),
    "E) Frozen 2, window 2→3":         simulate_frozen(2, 2),
    "F) Dummy races (2 seeds)":         simulate_dummy_races(),
}

KEY_DRIVERS = ["ANT", "SAI", "TSU", "BEA", "HAD", "HAM"]
SHOW_ROUNDS = 10

print("=" * 90)
print("  DUMMY RACE SEEDING vs FROZEN PERIOD")
print("  All scenarios: context pricing (α=0.5), power curve, $6M floor, ±10% cap")
print("=" * 90)

for label, history in scenarios.items():
    print(f"\n  ── {label}")
    print(f"  {'Driver':<6} {'Fair':>7} {'Pre':>7}", end="")
    for r in range(1, SHOW_ROUNDS + 1):
        print(f" {'R'+str(r):>7}", end="")
    print()

    for driver in KEY_DRIVERS:
        h = history[driver]
        fair = FAIR_PRICES.get(driver, DRIVER_FLOOR)
        row = f"  {driver:<6} {fmt_m(fair):>7} {fmt_m(h[0]):>7}"
        for r in range(1, SHOW_ROUNDS + 1):
            row += f" {fmt_m(h[r]):>7}"
        print(row)

# ── Mispricing over time ─────────────────────────────────────────────────

print(f"\n{'=' * 90}")
print(f"  TOTAL GRID MISPRICING ($M) BY ROUND")
print(f"{'=' * 90}")

print(f"\n  {'Scenario':<36} {'Pre':>5}", end="")
for r in range(1, SHOW_ROUNDS + 1):
    print(f" {'R'+str(r):>5}", end="")
print(f" {'R1-R8':>6}")

for label, history in scenarios.items():
    short = label[:36]
    mispr = []
    for r in range(0, SHOW_ROUNDS + 1):
        total = sum(abs(history[d][r] - FAIR_PRICES.get(d, DRIVER_FLOOR))
                    for d in DRIVER_AVG_2024 if d in FAIR_PRICES) / 1e6
        mispr.append(total)
    avg_r1_r8 = statistics.mean(mispr[1:9])
    print(f"  {short:<36} {mispr[0]:>5.1f}", end="")
    for r in range(1, SHOW_ROUNDS + 1):
        print(f" {mispr[r]:>5.1f}", end="")
    print(f" {avg_r1_r8:>5.1f}")

# ── Volatility: round-over-round price changes ──────────────────────────

print(f"\n{'=' * 90}")
print(f"  PRICE STABILITY")
print(f"{'=' * 90}")

print(f"\n  {'Scenario':<36} {'R1-R3 avg Δ':>12} {'R4-R24 avg Δ':>13} {'Full avg Δ':>11} {'Max Δ':>8}")

for label, history in scenarios.items():
    short = label[:36]
    early_changes = []
    late_changes = []
    all_changes = []
    for d in DRIVER_AVG_2024:
        h = history[d]
        for r in range(1, min(len(h), TOTAL_RACES + 1)):
            change = abs(h[r] - h[r - 1])
            all_changes.append(change)
            if r <= 3:
                early_changes.append(change)
            else:
                late_changes.append(change)

    early_avg = statistics.mean(early_changes) if early_changes else 0
    late_avg = statistics.mean(late_changes) if late_changes else 0
    full_avg = statistics.mean(all_changes)
    max_change = max(all_changes)
    print(f"  {short:<36} {fmt_m(int(early_avg)):>12} {fmt_m(int(late_avg)):>13} "
          f"{fmt_m(int(full_avg)):>11} {fmt_m(int(max_change)):>8}")

# ── Deep dive: dummy race mechanics for key drivers ──────────────────────

print(f"\n{'=' * 90}")
print(f"  DUMMY RACE WINDOW CONTENTS (first 5 races)")
print(f"{'=' * 90}")

for driver in KEY_DRIVERS:
    scores = RACE_SCORES.get(driver, [])
    dummy = PRESEASON_AVG[driver]
    fair = FAIR_PRICES.get(driver, DRIVER_FLOOR)
    print(f"\n  {driver}  (preseason avg: {dummy:.1f} pts/race, fair price: {fmt_m(fair)})")
    print(f"  {'Round':<7} {'Window contents':>30} {'Rolling avg':>11} {'Target':>8} {'Price':>8}")

    h = scenarios["F) Dummy races (2 seeds)"][driver]
    for rnd in range(1, 6):
        entries = []
        for i in range(WINDOW):
            race_idx = rnd - WINDOW + i
            if race_idx < 0:
                entries.append(dummy)
            else:
                entries.append(scores[race_idx] if race_idx < len(scores) else 0)
        rolling = sum(entries) / len(entries)
        target = power_curve_price(rolling, "driver")

        parts = []
        for i in range(WINDOW):
            race_idx = rnd - WINDOW + i
            if race_idx < 0:
                parts.append(f"({dummy:.1f})")
            else:
                parts.append(f"{scores[race_idx]}")
        window_str = " + ".join(parts)

        print(f"  R{rnd:<6} {window_str:>30}  avg={rolling:>5.1f}  {fmt_m(target):>8}  {fmt_m(h[rnd]):>8}")

print(f"\n{'=' * 90}")
