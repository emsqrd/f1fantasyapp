#!/usr/bin/env python3
"""
Fetch current SportsDeck prices for all F1 players (drivers + constructors)
and output a comparison table plus ready-to-paste SQL for seed-prices.sql.

Usage: python3 scripts/fetch-sportsdeck-prices.py
"""

import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://sportsdeck.com/api/au/f1/dreamteam/v1/players/{id}?embed=player_stats"
PLAYER_IDS = range(1, 42)  # 1-41 inclusive
MAX_WORKERS = 10

PRICE_MULTIPLIER = 262_000
PRICE_FLOOR = 3_000_000
ROUNDING_UNIT = 100_000

# Map SportsDeck last_name -> our abbreviation
# Built from seed.sql driver/constructor entries
DRIVER_MAP = {
    "Verstappen": "VER",
    "Hadjar": "HAD",
    "Russell": "RUS",
    "Antonelli": "ANT",
    "Leclerc": "LEC",
    "Hamilton": "HAM",
    "Norris": "NOR",
    "Piastri": "PIA",
    "Alonso": "ALO",
    "Stroll": "STR",
    "Gasly": "GAS",
    "Colapinto": "COL",
    "Albon": "ALB",
    "Sainz": "SAI",
    "Lawson": "LAW",
    "Lindblad": "LIN",
    "Hulkenberg": "HUL",
    "Bortoleto": "BOR",
    "Ocon": "OCO",
    "Bearman": "BEA",
    "Bottas": "BOT",
    "Perez": "PER",
    "Doohan": "DOO",
    "Tsunoda": "TSU",
}

CONSTRUCTOR_MAP = {
    "Red Bull": "RBR",
    "Mercedes": "MER",
    "Ferrari": "FER",
    "McLaren": "MCL",
    "Aston Martin": "AMR",
    "Alpine": "ALP",
    "Williams": "WIL",
    "Racing Bulls": "RBS",
    "Kick Sauber": "AUD",  # Kick Sauber became Audi for 2026
    "Haas": "HAA",
}

# Seed abbreviations with no SportsDeck data (new for 2026), kept at $3M floor
NO_API_DRIVERS = {"LIN", "BOT", "PER"}  # Lindblad (rookie), Bottas & Perez (Cadillac)
NO_API_CONSTRUCTORS = {"CAD"}  # Cadillac is brand new

# All seed driver/constructor abbreviations (for detecting missing entries)
ALL_SEED_DRIVERS = set(DRIVER_MAP.values()) | NO_API_DRIVERS
ALL_SEED_CONSTRUCTORS = set(CONSTRUCTOR_MAP.values()) | NO_API_CONSTRUCTORS


def round_100k(value):
    return round(value / ROUNDING_UNIT) * ROUNDING_UNIT


def calc_starting_price(season_average):
    if season_average == 0:
        return PRICE_FLOOR
    price = round_100k(PRICE_MULTIPLIER * season_average)
    return max(PRICE_FLOOR, price)


def calc_2025_season_average(player):
    """Calculate the 2025 season average from player_stats (excluding round 0)."""
    stats = player.get("player_stats", [])
    if not stats:
        return 0
    points = [s.get("points", 0) for s in stats if s.get("round", 0) > 0]
    if not points:
        return 0
    return sum(points) / len(points)


def fetch_player(player_id):
    url = BASE_URL.format(id=player_id)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "F1FantasyApp/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e), "id": player_id}


def get_api_price(player):
    """Extract the 2025 starting price (round 0 or earliest round) from player_stats.
    This is used for comparison only — 2026 prices come from the calculated formula."""
    stats = player.get("player_stats", [])
    if not stats:
        return None
    sorted_stats = sorted(stats, key=lambda s: s.get("round", 999))
    for s in sorted_stats:
        price = s.get("price")
        if price is not None:
            return price
    return None


# SportsDeck name overrides (API returns garbled/masked names for some players)
NAME_OVERRIDES = {
    6: {"first_name": "Jack", "last_name": "Doohan"},
}


def match_driver(last_name):
    """Match API last_name to our abbreviation, handling name variants."""
    # Exact match first
    if last_name in DRIVER_MAP:
        return DRIVER_MAP[last_name]
    # Fuzzy: check if any of our known names is contained in the API name
    # (handles cases like "*** Doohan" matching "Doohan")
    for known_name, abbrev in DRIVER_MAP.items():
        if known_name in last_name:
            return abbrev
    return None


def match_constructor(last_name):
    """Match API last_name to our abbreviation."""
    return CONSTRUCTOR_MAP.get(last_name)


def is_constructor(player):
    """Constructors have empty first_name in the API."""
    return not player.get("first_name", "").strip()


def main():
    print("Fetching SportsDeck player data (IDs 1-41)...\n")

    # Parallel fetch
    players = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(fetch_player, pid): pid for pid in PLAYER_IDS}
        for future in as_completed(futures):
            pid = futures[future]
            data = future.result()
            if "error" in data:
                print(f"  WARNING: Failed to fetch player {pid}: {data['error']}")
            else:
                players[pid] = data

    print(f"Fetched {len(players)} players successfully.\n")

    # Process and map
    drivers = []
    constructors = []
    unmatched = []
    seen_driver_abbrevs = set()
    seen_constructor_abbrevs = set()

    for pid in sorted(players.keys()):
        p = players[pid]
        overrides = NAME_OVERRIDES.get(pid, {})
        first_name = overrides.get("first_name", p.get("first_name", "")).strip()
        last_name = overrides.get("last_name", p.get("last_name", "")).strip()
        season_avg_2025 = calc_2025_season_average(p)
        api_price = get_api_price(p)
        price_2026 = calc_starting_price(season_avg_2025)

        if is_constructor(p):
            abbrev = match_constructor(last_name)
            if abbrev:
                if abbrev in seen_constructor_abbrevs:
                    continue  # Each constructor has 2 IDs in SportsDeck; skip duplicate
                seen_constructor_abbrevs.add(abbrev)
                constructors.append({
                    "abbreviation": abbrev,
                    "name": last_name,
                    "api_price": api_price,
                    "price_2026": price_2026,
                    "season_avg": season_avg_2025,
                })
            else:
                unmatched.append(f"Constructor: {last_name} (ID {pid})")
        else:
            abbrev = match_driver(last_name)
            if abbrev:
                if abbrev in seen_driver_abbrevs:
                    continue
                seen_driver_abbrevs.add(abbrev)
                drivers.append({
                    "abbreviation": abbrev,
                    "name": f"{first_name} {last_name}",
                    "api_price": api_price,
                    "price_2026": price_2026,
                    "season_avg": season_avg_2025,
                })
            else:
                unmatched.append(f"Driver: {first_name} {last_name} (ID {pid})")

    # Sort by abbreviation
    drivers.sort(key=lambda d: d["abbreviation"])
    constructors.sort(key=lambda c: c["abbreviation"])

    # Print comparison table
    def fmt_price(p):
        if p is None:
            return "N/A"
        return f"${p:>11,}"

    print("=" * 95)
    print("DRIVERS")
    print("=" * 95)
    print(f"{'Abbr':<6} {'Name':<22} {'2025 Start':>14} {'2025 Avg':>10} {'2026 Price':>14}")
    print("-" * 95)
    for d in drivers:
        print(f"{d['abbreviation']:<6} {d['name']:<22} {fmt_price(d['api_price']):>14} {d['season_avg']:>10.2f} {fmt_price(d['price_2026']):>14}")

    print()
    print("=" * 95)
    print("CONSTRUCTORS")
    print("=" * 95)
    print(f"{'Abbr':<6} {'Name':<22} {'2025 Start':>14} {'2025 Avg':>10} {'2026 Price':>14}")
    print("-" * 95)
    for c in constructors:
        print(f"{c['abbreviation']:<6} {c['name']:<22} {fmt_price(c['api_price']):>14} {c['season_avg']:>10.2f} {fmt_price(c['price_2026']):>14}")

    # Unmatched warnings
    if unmatched:
        print()
        print("=" * 90)
        print("UNMATCHED (no seed.sql mapping — likely retired/removed players)")
        print("=" * 90)
        for u in unmatched:
            print(f"  - {u}")

    # Info notes for seed entries without API data
    no_api = sorted(NO_API_DRIVERS | NO_API_CONSTRUCTORS)
    if no_api:
        print()
        print("=" * 90)
        print("NO API DATA (kept at $3M floor)")
        print("=" * 90)
        for abbrev in no_api:
            print(f"  - {abbrev}: No SportsDeck data (new for 2026)")

    # Generate SQL
    print()
    print("=" * 90)
    print("GENERATED SQL (for seed-prices.sql)")
    print("=" * 90)
    print()
    print("-- Driver prices (2026: calculated from 2025 season average)")

    all_driver_abbrevs = {d["abbreviation"] for d in drivers}
    for d in drivers:
        print(f"UPDATE \"Drivers\" SET \"Price\" = {d['price_2026']} WHERE \"Abbreviation\" = '{d['abbreviation']}';")
    for abbrev in sorted(NO_API_DRIVERS):
        if abbrev not in all_driver_abbrevs:
            print(f"UPDATE \"Drivers\" SET \"Price\" = {PRICE_FLOOR} WHERE \"Abbreviation\" = '{abbrev}';")

    print()
    print("-- Constructor prices (2026: calculated from 2025 season average)")

    all_constructor_abbrevs = {c["abbreviation"] for c in constructors}
    for c in constructors:
        print(f"UPDATE \"Constructors\" SET \"Price\" = {c['price_2026']} WHERE \"Abbreviation\" = '{c['abbreviation']}';")
    for abbrev in sorted(NO_API_CONSTRUCTORS):
        if abbrev not in all_constructor_abbrevs:
            print(f"UPDATE \"Constructors\" SET \"Price\" = {PRICE_FLOOR} WHERE \"Abbreviation\" = '{abbrev}';")


if __name__ == "__main__":
    main()
