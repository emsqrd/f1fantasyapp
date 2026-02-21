# SportsDeck Scoring Rules - Implementation Specification

## Overview

Points are awarded to participants based on the performance of their selected drivers and cars during each Round. Points are calculated separately for Qualifying (Starting Grid) and Race events.

**Scope:** These scoring rules apply to **feature races only** (not sprint races).

## Car/Constructor Selection & Scoring Rules

### Combined Rule ⚠️ CRITICAL

**Each car in a Racing Team is awarded the combined total points of all cars in that team (maximum 2 cars - the best performing two if >2 cars entered).**

**Key Implementation Details:**
- A participant selecting Car 1 from Racing Team A receives points for BOTH Car 1 AND Car 2
- A participant selecting both Car 1 AND Car 2 from Racing Team A receives the SAME combined points (not double)
- If Racing Team A has 3+ cars, only the top 2 performing cars count toward the combined total
- Multiple car selections from same team do NOT multiply points

**⚠️ MUST IMPLEMENT:** Support for constructors with >2 cars is required (not optional).

**Example Scenarios:**
```
Team Ferrari has Car 1 and Car 2
Car 1 finishes P3 → 60 points
Car 2 finishes P7 → 24 points
Combined total = 84 points

Participant A selects: Ferrari Car 1 only → Receives 84 points
Participant B selects: Ferrari Car 1 AND Car 2 → Receives 84 points
```

## Scoring Events

### 1. Qualifying / Starting Grid Points

**Timing:** Based on final official grid formation on race day, after pre-existing penalties applied

**Important Rules:**
- Points awarded once, based on official grid formation
- NOT adjusted for race day changes after grid formation (mechanical faults, warm-up lap incidents, restarts)
- Pre-race penalties ARE included (engine changes, carry-over penalties from qualifying or previous races)

**Point Values:**

| Position | Driver Points | Constructor Points |
|----------|---------------|-------------------|
| 1        | 50            | 30                |
| 2        | 36            | 22                |
| 3        | 30            | 18                |
| 4        | 24            | 15                |
| 5        | 20            | 12                |
| 6        | 16            | 10                |
| 7        | 12            | 7                 |
| 8        | 8             | 5                 |
| 9        | 4             | 3                 |
| 10       | 4             | 3                 |
| 11       | 3             | 2                 |
| 12       | 3             | 2                 |
| 13       | 2             | 1                 |
| 14       | 2             | 1                 |
| 15       | 1             | 1                 |
| 16       | 1             | 1                 |

**Implementation Notes:**
- Positions 17+ receive 0 points
- Grid position data source: Official FIA grid formation

### 2. Race Result Points

**Timing:** Based on final classified finishing position

**Point Values:**

| Position | Driver Points | Constructor Points |
|----------|---------------|-------------------|
| 1        | 100           | 60                |
| 2        | 72            | 44                |
| 3        | 60            | 36                |
| 4        | 48            | 30                |
| 5        | 40            | 24                |
| 6        | 32            | 20                |
| 7        | 24            | 14                |
| 8        | 16            | 10                |
| 9        | 8             | 6                 |
| 10       | 8             | 6                 |
| 11       | 6             | 4                 |
| 12       | 6             | 4                 |
| 13       | 4             | 2                 |
| 14       | 4             | 2                 |
| 15       | 2             | 2                 |
| 16       | 2             | 2                 |

**Implementation Notes:**
- Positions 17+ receive 0 points
- Must be classified as a finisher to receive points

### 3. Bonus Points

#### Position Gained Bonus

**Formula:** `+4 points per position gained` (from Starting Grid to final race position)

**Applies to:** Both Drivers and Constructors/Cars

**Calculation:**
```
positions_gained = starting_grid_position - final_race_position
bonus_points = positions_gained × 4
```

**Examples:**
- Started P10, finished P6 → +4 positions × 4 = +16 bonus points
- Started P3, finished P1 → +2 positions × 4 = +8 bonus points
- Started P5, finished P8 → -3 positions (lost positions) = 0 bonus points (no penalty)

**Edge Cases:**
- If driver/car loses positions: 0 bonus points (not a penalty)
- If driver starts from pit lane: TBD - need clarification on starting position value
- If driver retires: See retirement rule below

#### Fastest Lap Bonus

**Award:** +20 points

**Applies to:**
- Driver who sets fastest lap
- Constructor/Car of the driver who sets fastest lap

**Requirements:**
- Must be classified as a finisher (retirement = no fastest lap bonus)

### 4. Penalties

#### Retirement / Non-Classified Finish

**Rule:** A retirement that results in a non-classified finishing position = **0 POINTS**

**Applies to:**
- All race result points forfeited
- Qualifying/Grid points are NOT affected (already awarded)
- Position gained bonus forfeited
- Fastest lap bonus forfeited (cannot receive if not classified)

**Implementation Notes:**
- Check FIA classification status
- Non-classified = did not complete sufficient race distance (typically <90% race distance)
- Drivers who retire but are classified still receive points based on classified position
- **Disqualifications (DSQ) are treated the same as non-classified** (0 points)

## Implementation Checklist

### Data Requirements
- [ ] Starting grid position (official race day grid)
- [ ] Final race finishing position
- [ ] Classification status (classified vs. non-classified)
- [ ] Fastest lap attribution (driver + constructor)
- [ ] Constructor/team associations for drivers and cars
- [ ] Constructor car performance rankings (for >2 car teams - Combined Rule)

### Scoring Calculation Order
1. Calculate Qualifying/Grid points (one-time, at race start)
2. Calculate Race Result base points (from position table)
3. Calculate Position Gained Bonus (grid vs. finish)
4. Calculate Fastest Lap Bonus
5. Apply Retirement Penalty (zero out race points if non-classified)
6. Apply Combined Rule for constructors (sum top 2 cars per team)

### Edge Cases to Handle
- [ ] Non-classified finishes (retirements)
- [ ] Pit lane starts (position gained calculation)
- [ ] Constructors with >2 cars (rank and select top 2)
- [ ] Fastest lap set by retired driver (no bonus)
- [ ] Grid penalties applied after official grid formation
- [ ] Participants with multiple cars from same constructor
- [ ] Drivers who change teams mid-season

### Testing Scenarios
- [ ] Normal race finish (no bonuses/penalties)
- [ ] Driver with position gained bonus
- [ ] Driver with fastest lap
- [ ] Retired driver (non-classified)
- [ ] Constructor Combined Rule with 2 cars
- [ ] Constructor Combined Rule with >2 cars
- [ ] Participant with multiple cars from same constructor
- [ ] Full round scoring (all participants, all drivers/cars)

## Outstanding Questions for Clarification

1. **Pit Lane Starts:** How is starting position calculated for position gained bonus when driver starts from pit lane?
2. **Fastest Lap Edge Case:** If fastest lap is set by a driver who later retires and is non-classified, do they lose the +20 or is it awarded when achieved?
3. **Constructor Points - Which Cars:** When applying Combined Rule, is it the top 2 cars by finishing position, or by total fantasy points earned?
