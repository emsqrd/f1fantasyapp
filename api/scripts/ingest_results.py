"""
ingest_results.py — Fetch F1 results via FastF1 and submit them to the
F1 Fantasy API.

Usage:
    cd api/scripts
    source .venv/bin/activate
    python3 ingest_results.py --year 2026 --round 1
    python3 ingest_results.py --year 2026 --round 1 --env prod
"""

import argparse
import os
import sys
from enum import IntEnum
from itertools import combinations

import fastf1
import pandas as pd
import requests
from dotenv import dotenv_values

CACHE_DIR = ".ff1_cache"

# FastF1 status strings that mean the driver finished the race
_CLASSIFIED_STATUSES = {"Finished"}


class RaceStatus(IntEnum):
    """Mirrors the C# RaceStatus enum in Data/Entities/RaceStatus.cs."""

    CLASSIFIED = 0
    DNF = 1
    DSQ = 2
    DNS = 3


class IngestError(Exception):
    """Raised when the import process encounters a non-recoverable error."""


class ApiError(IngestError):
    """Raised when an API request fails."""

    def __init__(self, action: str, status_code: int, body: str):
        self.action = action
        self.status_code = status_code
        self.body = body
        super().__init__(f"{action} failed ({status_code}): {body}")


def create_api_session(token: str) -> requests.Session:
    """Create a requests session with authorization headers."""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    return session


def authenticate(supabase_url: str, anon_key: str, email: str, password: str) -> str:
    """Sign in to Supabase and return an access token."""
    resp = requests.post(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        json={"email": email, "password": password},
        headers={
            "apikey": anon_key,
            "Content-Type": "application/json",
        },
    )
    if resp.status_code != 200:
        raise ApiError("Authentication", resp.status_code, resp.text)
    token = resp.json().get("access_token")
    if not token:
        raise IngestError("Authentication response missing access_token")
    return token


def fetch_driver_mapping(session: requests.Session, api_url: str) -> dict[str, int]:
    """Fetch drivers from the API and return abbreviation -> id mapping."""
    resp = session.get(f"{api_url}/api/drivers")
    if resp.status_code >= 400:
        raise ApiError("Fetch drivers", resp.status_code, resp.text)
    return {d["abbreviation"]: d["id"] for d in resp.json()}


def fetch_races(session: requests.Session, api_url: str) -> list[dict]:
    """Fetch all races from the API."""
    resp = session.get(f"{api_url}/api/races")
    if resp.status_code >= 400:
        raise ApiError("Fetch races", resp.status_code, resp.text)
    return resp.json()


def find_race(races: list[dict], round_number: int) -> dict:
    """Find a race by round number."""
    for race in races:
        if race["round"] == round_number:
            return race
    raise IngestError(f"Race for round {round_number} not found in API")


def load_session(year: int, round_number: int, session_name: str):
    """Load a FastF1 session. Returns the session object, or None on failure."""
    try:
        session = fastf1.get_session(year, round_number, session_name)
        session.load(telemetry=False, weather=False, messages=False)
        return session
    except Exception as exc:
        print(f"  Warning: could not load {session_name} R{round_number}: {exc}")
        return None


def _build_pit_laps(laps) -> set[tuple[str, int]]:
    """Build a set of (driver, lap_number) tuples where the driver pitted."""
    pit_laps = set()
    for _, row in laps.iterrows():
        if pd.notna(row.get("PitInTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))
        if pd.notna(row.get("PitOutTime")):
            pit_laps.add((row["Driver"], int(row["LapNumber"])))
    return pit_laps


def _either_pitted(
    driver_a: str, driver_b: str, prev_lap: int, curr_lap: int, pit_laps: set
) -> bool:
    """Check if either driver pitted on the previous or current lap."""
    return (
        (driver_a, curr_lap) in pit_laps
        or (driver_a, prev_lap) in pit_laps
        or (driver_b, curr_lap) in pit_laps
        or (driver_b, prev_lap) in pit_laps
    )


def count_overtakes(laps) -> dict[str, int]:
    """Count on-track overtakes per driver from lap-by-lap position data.

    Uses pairwise comparison: an overtake occurs when driver A was behind
    driver B on lap N-1 but ahead on lap N, and neither driver pitted on
    those laps.

    Excludes:
    - Lap 1 (first-lap chaos is captured by grid-to-finish position change)
    - Laps where either driver in the pair entered or exited the pits
    """
    if laps is None or laps.empty:
        return {}

    pos = laps.pivot_table(index="LapNumber", columns="Driver", values="Position")
    if pos.empty:
        return {}

    drivers = list(pos.columns)
    pit_laps = _build_pit_laps(laps)
    sorted_laps = sorted(pos.index)
    overtakes = {driver: 0 for driver in drivers}

    for prev_lap, curr_lap in zip(sorted_laps, sorted_laps[1:]):
        if prev_lap <= 1:
            continue

        prev_positions = pos.loc[prev_lap]
        curr_positions = pos.loc[curr_lap]

        for driver_a, driver_b in combinations(drivers, 2):
            if _either_pitted(driver_a, driver_b, int(prev_lap), int(curr_lap), pit_laps):
                continue

            a_prev, a_curr = prev_positions[driver_a], curr_positions[driver_a]
            b_prev, b_curr = prev_positions[driver_b], curr_positions[driver_b]

            if pd.isna(a_prev) or pd.isna(a_curr) or pd.isna(b_prev) or pd.isna(b_curr):
                continue

            if a_prev > b_prev and a_curr < b_curr:
                overtakes[driver_a] += 1
            elif b_prev > a_prev and b_curr < a_curr:
                overtakes[driver_b] += 1

    return overtakes


def map_status(status_str) -> RaceStatus:
    """Map a FastF1 status string to a RaceStatus enum value."""
    if pd.isna(status_str) or status_str is None:
        return RaceStatus.DNS

    status = str(status_str).strip()

    if status == "Disqualified":
        return RaceStatus.DSQ

    if status in _CLASSIFIED_STATUSES or "Lap" in status:
        # "Finished" or lapped (e.g. "+1 Lap", "+2 Laps")
        return RaceStatus.CLASSIFIED

    # Everything else: "Retired", mechanical failures, accidents, etc.
    return RaceStatus.DNF


def build_qualifying_payload(
    session, driver_map: dict[str, int]
) -> tuple[list[dict], list[str]]:
    """Build the qualifying results payload from a FastF1 qualifying session.

    Returns (payload, warnings) where warnings lists any skipped drivers.
    """
    items = []
    warnings = []
    for _, row in session.results.iterrows():
        abbr = row.get("Abbreviation", "")
        driver_id = driver_map.get(abbr)
        if driver_id is None:
            warnings.append(f"Driver '{abbr}' not found in API, skipping")
            continue

        position = row.get("Position")
        if pd.isna(position):
            warnings.append(f"Driver '{abbr}' has no qualifying position, skipping")
            continue

        items.append({
            "driverId": driver_id,
            "position": int(position),
        })
    return items, warnings


def build_race_payload(
    session, driver_map: dict[str, int], overtakes: dict[str, int]
) -> tuple[list[dict], list[str]]:
    """Build the race/sprint results payload from a FastF1 session.

    Returns (payload, warnings) where warnings lists any skipped drivers.
    """
    items = []
    warnings = []
    for _, row in session.results.iterrows():
        abbr = row.get("Abbreviation", "")
        driver_id = driver_map.get(abbr)
        if driver_id is None:
            warnings.append(f"Driver '{abbr}' not found in API, skipping")
            continue

        status = map_status(row.get("Status", ""))

        grid = row.get("GridPosition")
        grid = 0 if pd.isna(grid) else int(grid)

        finish = row.get("Position")
        if pd.isna(finish) or status != RaceStatus.CLASSIFIED:
            finish_position = None
        else:
            finish_position = int(finish)

        fastest_lap = bool(row.get("FastestLap", False))

        items.append({
            "driverId": driver_id,
            "gridPosition": grid,
            "finishPosition": finish_position,
            "overtakes": overtakes.get(abbr, 0),
            "fastestLap": fastest_lap,
            "status": int(status),
        })
    return items, warnings


def submit_results(
    session: requests.Session,
    api_url: str,
    race_id: int,
    session_type: str,
    payload: list[dict],
) -> None:
    """PUT results to the API endpoint."""
    url = f"{api_url}/api/races/{race_id}/results/{session_type}"
    resp = session.put(url, json=payload)
    if resp.status_code >= 400:
        raise ApiError(f"Submit {session_type} results", resp.status_code, resp.text)
    print(f"  {session_type.capitalize()} results submitted ({len(payload)} drivers)")


def load_config(env: str) -> dict[str, str | None]:
    """Load and validate environment config."""
    env_file = f".env.{env}"
    config = dotenv_values(env_file)
    required_keys = [
        "F1_SUPABASE_URL",
        "F1_SUPABASE_ANON_KEY",
        "F1_IMPORT_EMAIL",
        "F1_IMPORT_PASSWORD",
        "F1_API_URL",
    ]
    missing = [k for k in required_keys if not config.get(k)]
    if missing:
        raise IngestError(f"Missing keys in {env_file}: {', '.join(missing)}")
    return config


def report_warnings(warnings: list[str], session_name: str) -> None:
    """Print any warnings about skipped drivers."""
    if not warnings:
        return
    print(f"\n  Warnings for {session_name}:")
    for w in warnings:
        print(f"    - {w}")


def ingest(year: int, round_number: int, env: str) -> None:
    """Run the full import flow for a single round."""
    config = load_config(env)

    # Set up FastF1 cache
    os.makedirs(CACHE_DIR, exist_ok=True)
    fastf1.Cache.enable_cache(CACHE_DIR)

    # Authenticate
    print(f"Authenticating against {config['F1_SUPABASE_URL']}...")
    token = authenticate(
        config["F1_SUPABASE_URL"],
        config["F1_SUPABASE_ANON_KEY"],
        config["F1_IMPORT_EMAIL"],
        config["F1_IMPORT_PASSWORD"],
    )
    print("  Authenticated")

    api_session = create_api_session(token)
    api_url = config["F1_API_URL"]

    # Fetch driver mapping and race info
    print("Fetching driver list...")
    driver_map = fetch_driver_mapping(api_session, api_url)
    print(f"  Found {len(driver_map)} drivers")

    print("Fetching race list...")
    races = fetch_races(api_session, api_url)
    race = find_race(races, round_number)
    race_id = race["id"]
    has_sprint = race.get("hasSprint", False)
    print(f"  Race: {race['name']} (id={race_id}, hasSprint={has_sprint})")

    # Qualifying
    print(f"Loading qualifying session (R{round_number})...")
    quali = load_session(year, round_number, "Qualifying")
    if quali is not None:
        payload, warnings = build_qualifying_payload(quali, driver_map)
        report_warnings(warnings, "qualifying")
        if payload:
            submit_results(api_session, api_url, race_id, "qualifying", payload)
    else:
        print("  Skipping qualifying — session not available")

    # Sprint
    if has_sprint:
        print(f"Loading sprint session (R{round_number})...")
        sprint = load_session(year, round_number, "Sprint")
        if sprint is not None:
            sprint_overtakes = count_overtakes(sprint.laps)
            payload, warnings = build_race_payload(sprint, driver_map, sprint_overtakes)
            report_warnings(warnings, "sprint")
            if payload:
                submit_results(api_session, api_url, race_id, "sprint", payload)
        else:
            print("  Skipping sprint — session not available")

    # Race
    print(f"Loading race session (R{round_number})...")
    race_session = load_session(year, round_number, "Race")
    if race_session is not None:
        race_overtakes = count_overtakes(race_session.laps)
        payload, warnings = build_race_payload(race_session, driver_map, race_overtakes)
        report_warnings(warnings, "race")
        if payload:
            submit_results(api_session, api_url, race_id, "race", payload)
    else:
        print("  Skipping race — session not available")

    print("Done!")


def main():
    parser = argparse.ArgumentParser(description="Import F1 results into the Fantasy API")
    parser.add_argument("--year", type=int, required=True, help="Season year")
    parser.add_argument("--round", type=int, required=True, help="Round number")
    parser.add_argument(
        "--env",
        choices=["local", "prod"],
        default="local",
        help="Environment (default: local)",
    )
    args = parser.parse_args()

    try:
        ingest(args.year, args.round, args.env)
    except IngestError as exc:
        print(f"\nError: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
