"""
scoring.py — Scoring logic matching decisions/scoring.md.

Race finish: P1=25, P2=18, P3=15, P4=12, P5=10, P6=8, P7=6, P8=4, P9=2, P10=1
Qualifying:  P1=10, P2=9, ..., P10=1
Sprint:      P1=8, P2=7, ..., P8=1

Position change: +1 per position gained, -1 per position lost (race and sprint).
Overtakes:       +1 per on-track position gained (lap-by-lap, excl. pit laps and lap 1).
Fastest lap:     +3 (race), +2 (sprint).
DNF/DSQ/DNS:     -10 (race), -5 (sprint). No position loss calculated for DNFs.
Constructor:     Sum of both drivers' points across all sessions.
"""

DRIVER_RACE_PTS: dict[int, int] = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
    6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}

DRIVER_QUALI_PTS: dict[int, int] = {
    1: 10, 2: 9, 3: 8, 4: 7, 5: 6,
    6: 5, 7: 4, 8: 3, 9: 2, 10: 1,
}

DRIVER_SPRINT_PTS: dict[int, int] = {
    1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1,
}

RACE_FL_BONUS = 3
SPRINT_FL_BONUS = 2
RACE_DNF_PENALTY = -10
SPRINT_DNF_PENALTY = -5


def score_driver_session(
    position: int | None,
    grid_position: int | None,
    has_fastest_lap: bool,
    is_dnf: bool,
    session: str,
    overtakes: int = 0,
) -> dict:
    """
    Score a driver for a single race or sprint session.

    Position change = grid_position - finish_position (positive = gained).
    Overtakes = on-track position gains from lap-by-lap data (computed by caller).
    DNF drivers get 0 finish pts + penalty, no position change.
    """
    table = DRIVER_RACE_PTS if session == "race" else DRIVER_SPRINT_PTS
    fl_bonus = RACE_FL_BONUS if session == "race" else SPRINT_FL_BONUS
    dnf_penalty = RACE_DNF_PENALTY if session == "race" else SPRINT_DNF_PENALTY

    if is_dnf or position is None:
        finish = 0
        pos_change = 0
    else:
        finish = table.get(int(position), 0)
        if grid_position is not None:
            pos_change = int(grid_position) - int(position)  # positive = gained
        else:
            pos_change = 0

    fl = fl_bonus if has_fastest_lap else 0
    penalty = dnf_penalty if is_dnf else 0
    total = finish + pos_change + overtakes + fl + penalty

    return {
        "finish": finish,
        "pos_change": pos_change,
        "overtakes": overtakes,
        "fl": fl,
        "penalty": penalty,
        "total": total,
    }


def score_driver_quali(position: int | None) -> int:
    """Return qualifying points for the given position (0 if P11+)."""
    if position is None:
        return 0
    return DRIVER_QUALI_PTS.get(int(position), 0)
