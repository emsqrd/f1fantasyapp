"""
scoring.py — Pure scoring logic for the F1 Fantasy simulation.

No I/O, no FastF1 imports. All functions are stateless and easily unit-testable.
"""

# ── Points tables ─────────────────────────────────────────────────────────

DRIVER_RACE_PTS: dict[int, int] = {
    1: 25, 2: 20, 3: 16, 4: 13, 5: 11,
    6: 9, 7: 7, 8: 5, 9: 3, 10: 2,
    **{p: 1 for p in range(11, 16)},
}

DRIVER_QUALI_PTS: dict[int, int] = {
    1: 10, 2: 9, 3: 8, 4: 7, 5: 6,
    6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
}

DRIVER_SPRINT_PTS: dict[int, int] = {
    1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
}

# ── Driver scoring ────────────────────────────────────────────────────────


def score_driver_session(
    position: int | None,
    grid_position: int | None,
    has_fastest_lap: bool,
    is_dnf: bool,
    session: str,
) -> dict:
    """
    Score a driver for a single race or sprint session.

    Args:
        position: Finishing position (None if DNF/not classified).
        grid_position: Starting grid position after any grid penalties (None if DNS).
        has_fastest_lap: Whether the driver set the session's fastest lap.
        is_dnf: True for DNF / DSQ / DNS.
        session: "race" or "sprint".

    Returns:
        dict with keys: finish, gain, fl, penalty, total
        (penalty is already negative; total = finish + gain + fl + penalty)
    """
    table = DRIVER_RACE_PTS if session == "race" else DRIVER_SPRINT_PTS
    fl_bonus = 10 if session == "race" else 5

    if is_dnf or position is None:
        finish = 0
        gain = 0
    else:
        finish = table.get(int(position), 0)
        if grid_position is not None:
            gain = max(0, int(grid_position) - int(position))
        else:
            gain = 0

    fl = fl_bonus if has_fastest_lap else 0
    penalty = (-10 if session == "race" else -5) if is_dnf else 0
    total = finish + gain + fl + penalty

    return {"finish": finish, "gain": gain, "fl": fl, "penalty": penalty, "total": total}


def score_driver_quali(position: int | None) -> int:
    """Return qualifying points for the given position (0 if P11+)."""
    if position is None:
        return 0
    return DRIVER_QUALI_PTS.get(int(position), 0)


# ── Constructor scoring ───────────────────────────────────────────────────


def score_constructor_weekend(
    driver_a_race: dict,
    driver_b_race: dict,
    driver_a_sprint: dict | None = None,
    driver_b_sprint: dict | None = None,
    driver_a_quali: int = 0,
    driver_b_quali: int = 0,
) -> dict:
    """
    Score a constructor for a full weekend.

    Constructor score = sum of both drivers' fantasy points across all sessions
    (qualifying + race + sprint) plus -5 per DNF in race/sprint.

    Args:
        driver_a_race: Score dict from score_driver_session() for race.
        driver_b_race: Score dict from score_driver_session() for race.
        driver_a_sprint: Score dict from score_driver_session() for sprint (or None).
        driver_b_sprint: Score dict from score_driver_session() for sprint (or None).
        driver_a_quali: Qualifying points for driver A.
        driver_b_quali: Qualifying points for driver B.

    Returns:
        dict with keys: quali_sum, race_driver_sum, race_penalty, race_total,
        sprint_driver_sum, sprint_penalty, sprint_total, total
    """
    # Qualifying
    quali_sum = driver_a_quali + driver_b_quali

    # Race
    race_driver_sum = driver_a_race.get("total", 0) + driver_b_race.get("total", 0)
    race_penalty = (
        (-5 if driver_a_race.get("is_dnf", False) else 0)
        + (-5 if driver_b_race.get("is_dnf", False) else 0)
    )
    race_total = race_driver_sum + race_penalty

    # Sprint
    if driver_a_sprint is not None and driver_b_sprint is not None:
        sprint_driver_sum = driver_a_sprint.get("total", 0) + driver_b_sprint.get("total", 0)
        sprint_penalty = (
            (-5 if driver_a_sprint.get("is_dnf", False) else 0)
            + (-5 if driver_b_sprint.get("is_dnf", False) else 0)
        )
        sprint_total = sprint_driver_sum + sprint_penalty
    else:
        sprint_driver_sum = None
        sprint_penalty = None
        sprint_total = None

    total = quali_sum + race_total + (sprint_total or 0)

    return {
        "quali_sum": quali_sum,
        "race_driver_sum": race_driver_sum,
        "race_penalty": race_penalty,
        "race_total": race_total,
        "sprint_driver_sum": sprint_driver_sum,
        "sprint_penalty": sprint_penalty,
        "sprint_total": sprint_total,
        "total": total,
    }


# ── Captain ───────────────────────────────────────────────────────────────


def apply_captain(positive_pts: int, is_dnf: bool) -> int:
    """
    Apply the captain multiplier.

    The captain bonus doubles positive points (finish + gain + fl across all
    sessions). The DNF penalty is never doubled: -10 for race, -5 for sprint.
    This function is used for race-captain analysis and applies the race penalty.

    Args:
        positive_pts: Sum of all positive scoring components (no penalty).
        is_dnf: Whether the captain received a DNF/DSQ/DNS in the race session.

    Returns:
        Total captain points = positive_pts * 2 + (-10 if is_dnf else 0)
    """
    return positive_pts * 2 + (-10 if is_dnf else 0)
