# Scoring

How points are earned: which events score and how many points each is worth.

The race is the primary scoring event. Qualifying is secondary (~40% of race value at P1), the sprint is tertiary (~32%).

## Qualifying

### Drivers

| Position | Points |
| -------- | ------ |
| P1       | 10     |
| P2       | 9      |
| P3       | 8      |
| P4       | 7      |
| P5       | 6      |
| P6       | 5      |
| P7       | 4      |
| P8       | 3      |
| P9       | 2      |
| P10      | 1      |
| P11+     | 0      |

**Sprint qualifying is not scored.** It determines the sprint grid order but earns no points.

**Qualifying retirements carry no penalty.** A driver who retires during qualifying scores their classified qualifying position — no additional penalty applied.

### Constructors

A constructor's qualifying score is the **sum of both drivers' qualifying points**. No separate table — constructor pick value follows directly from driver performance.

## Sprint

_Applies on sprint weekends only._

### Drivers

| Position | Points |
| -------- | ------ |
| P1       | 8      |
| P2       | 7      |
| P3       | 6      |
| P4       | 5      |
| P5       | 4      |
| P6       | 3      |
| P7       | 2      |
| P8       | 1      |
| P9+      | 0      |

| Event           | Points                 |
| --------------- | ---------------------- |
| Position gain   | +1 per position gained |
| Position loss   | −1 per position lost   |
| Overtake        | +1 per on-track position gained |
| Fastest lap     | +2                     |
| DNF / DSQ / DNS | −5                     |

**Position change** is measured from sprint grid position (set by sprint qualifying results, after any grid penalties) to finish position. Unclassified drivers (DNF/NC) do not have position losses calculated — they receive the −5 penalty instead.

**Overtakes** are counted from lap-by-lap position data. A position gain counts when a driver moves up in the running order between consecutive laps, excluding laps where the driver entered or exited the pits. First-lap position changes (grid to end of lap 1) are not counted — they are already captured by the grid-to-finish position change scoring. DNF drivers can still accumulate overtake points from laps completed before retirement.

**Fastest lap bonus applies even if the driver DNFs**, provided the lap time stands in the final classification (+2 − 5 = −3 net).

**DNF / DSQ / DNS are treated identically.** The penalty applies regardless of whether the driver did not start, retired during the sprint, or was disqualified. The FIA sprint classification is authoritative — a driver listed as DNF or Not Classified receives 0 finish points and the −5 penalty.

### Constructors

A constructor's sprint score is the **sum of both drivers' sprint points**. No additional penalty — the driver's −5 already flows through the combined total.

## Race

### Drivers

| Position | Points |
| -------- | ------ |
| P1       | 25     |
| P2       | 18     |
| P3       | 15     |
| P4       | 12     |
| P5       | 10     |
| P6       | 8      |
| P7       | 6      |
| P8       | 4      |
| P9       | 2      |
| P10      | 1      |
| P11+     | 0      |

| Event           | Points                 |
| --------------- | ---------------------- |
| Position gain   | +1 per position gained |
| Position loss   | −1 per position lost   |
| Overtake        | +1 per on-track position gained |
| Fastest lap     | +3                     |
| DNF / DSQ / DNS | −10                    |

**Position change** is measured from grid position (after any penalties) to finish position. Unclassified drivers (DNF/NC) do not have position losses calculated — they receive the −10 penalty instead.

**Overtakes** are counted from lap-by-lap position data. A position gain counts when a driver moves up in the running order between consecutive laps, excluding laps where the driver entered or exited the pits. First-lap position changes (grid to end of lap 1) are not counted — they are already captured by the grid-to-finish position change scoring. DNF drivers can still accumulate overtake points from laps completed before retirement.

**Fastest lap bonus applies even if the driver DNFs**, provided the lap time stands in the final classification (+3 − 10 = −7 net).

**DNF / DSQ / DNS are treated identically.** −10 is equivalent to losing a P5 finish — noticeable without being catastrophic over a season. The FIA race classification is authoritative — a driver who retires but completes 90%+ of race distance may still receive a classified finishing position and no penalty applies. A driver listed as DNF or Not Classified receives 0 finish points and the −10 penalty.

**Red-flagged races score from the official FIA classification.** If a race is red-flagged and the result is based on a prior lap, the FIA's published finishing positions are used as-is. No partial points — scoring is applied normally to whatever classification the FIA produces.

**Captain multiplier applies to all points across the entire weekend.** If the captain DNFs, the −10 (race) or −5 (sprint) penalty is also doubled — the captain designation amplifies both upside and downside.

### Constructors

A constructor's race score is the **sum of both drivers' race points**. No additional penalty — the driver's −10 already flows through the combined total.

---

## Worked Examples

**Driver weekend (standard):**

| Scenario                                             | Race | Qualifying | Position change | Total |
| ---------------------------------------------------- | ---- | ---------- | --------------- | ----- |
| Dominant (P1 race, P1 quali, no gain)                | 25   | 10         | 0               | 35    |
| Mid-field mover (P6 race, P12 quali, +6 grid→finish) | 8    | 0          | 6               | 14    |
| Consistent mid (P7 race, P6 quali, −1)               | 6    | 5          | −1              | 10    |
| Just outside points (P12 race, P14 quali, +2)        | 0    | 0          | 2               | 2     |

**Constructor weekend (standard — qualifying + race):**

| Constructor                      | Driver A (quali + race) | Driver B (quali + race) | Total  |
| -------------------------------- | ----------------------- | ----------------------- | ------ |
| McLaren (Q2/Q5, P2/P5, clean)    | 9 + 18 = 27             | 6 + 10 = 16             | 43 pts |
| Red Bull (Q1/Q12, P1/P15, clean) | 10 + 25 = 35            | 0 + (−3) = −3           | 32 pts |
| Haas (Q8/Q9, P8/P9, clean)       | 3 + 4 = 7               | 2 + 2 = 4               | 11 pts |
| Williams (Q11/Q16, P12/DNF)      | 0 + (−1) = −1           | 0 + (−10) = −10         | −11 pts |

Red Bull has the race winner but scores 11 pts less than McLaren as a constructor. The second seat is priced into the constructor pick.
