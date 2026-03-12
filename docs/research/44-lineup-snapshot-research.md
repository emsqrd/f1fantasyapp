# Purpose

Research is needed regarding [gh issue #44](https://github.com/emsqrd/f1fantasyapp/issues/44). I need options for how to create snapshots of lineups. Or if there are better alternatives.

# Business Requirements

Teams need to be able to distinguish between which combination of drivers and constructors they have from one week to the next. Whatever the lineup is as of the `lockDeadline` is what should be considered as that round's lineup and will be used for scoring purposes for that round. This is needed for active scoring as well as historical score tracking. The options must be easy to maintain and scale as more teams join this app. Review all `claude.md` files in the project, but do not read any code files at this time.

# Questions to keep in mind

- How do other fantasy sports app solve this?
- How do other Formula 1 fantasy apps solve this?
- What considerations should I make when making a decision?
- Should I consider alternatives to snapshoting lineups that still meet the business requirements? If so, why?

# Scope & Assumptions

- **Snapshot capture only** — focus on how to capture the lineup at lock time, not on how the scoring engine will consume it. Note relevant scoring engine considerations where they arise.
- **Infrastructure constraints** — flag options that add meaningful cost or complexity beyond what free-tier Fly.io + Supabase already provides.
- **Alternatives** — give equal weight to alternatives to snapshotting; the goal is to validate or challenge the approach, not assume snapshotting is the answer.

# Instructions

- Use web search agents if needed
- Do not hallucinate theories
- Generate fact and data based research

---

# Findings

## 1. How Other Fantasy Sports Apps Solve This

**Important caveat:** No major platform (DraftKings, FanDuel, ESPN, Yahoo, NFL Fantasy) has published engineering documentation describing their exact internal schema or snapshot mechanism. What follows is either publicly documented behavior or inferences drawn from observable APIs.

### Fantasy Premier League (FPL) — Most Documented Case

FPL exposes a public, versioned API endpoint per manager per gameweek:

```
GET https://fantasy.premierleague.com/api/entry/{manager_id}/event/{event_id}/picks/
```

This returns `picks` (one object per player slot with `element`, `position`, `multiplier`, `is_captain`) and `entry_history` (points, transfers, chip used). The endpoint works for **all past gameweeks** and is parameterized by both `manager_id` and `event_id`. This is direct, observable evidence that FPL stores a complete lineup record per manager per gameweek as a separate, immutable record. Historical picks are never mutated — once the gameweek deadline passes, that record is fixed.

Sources: [FPL APIs Explained](https://www.oliverlooney.com/blogs/FPL-APIs-Explained) · [FPL API Guide (Medium)](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19) · [Postman FPL Docs](https://www.postman.com/fplassist/fpl-assist/documentation/zqlmv01/fantasy-premier-league-api) · [fpl Python Library](https://fpl.readthedocs.io/en/latest/classes/user.html)

### ESPN Fantasy

ESPN's v3 API exposes a `scoringPeriodId` parameter on its boxscore endpoint. Third-party researchers ([Steven Morse's ESPN Fantasy API documentation](https://stmorse.github.io/journal/espn-fantasy-v3.html)) have confirmed that each week's lineup — including `lineupSlot`, `playerId`, `projectedScore`, `actualScore` — is independently queryable by `scoringPeriodId`. Historical scoring periods are accessible independently, which is only possible if lineup state was captured per scoring period rather than stored as a single mutable current roster.

### DraftKings / FanDuel (Daily Fantasy Sports)

DFS works differently from season-long fantasy. In DFS:
- A lineup is submitted to a specific **contest**, which has a start time.
- The contest entry record is effectively the snapshot — it's associated with the contest at submission.
- Entries can be edited up until the first player in the slate locks; after that the entry becomes immutable.

FanDuel uses Confluent (Kafka) and Apache Flink for live event streaming and scoring. Incoming player stat events are matched against stored entry records. The internal schema is undisclosed but the architecture is confirmed. Source: [AWS/FanDuel Redshift Case Study](https://aws.amazon.com/blogs/big-data/how-fanduel-adopted-a-modern-amazon-redshift-architecture-to-serve-critical-business-workloads/)

The DFS model is less applicable here — it's a contest-entry architecture, not a season-long roster-with-lock model.

---

## 2. How F1-Specific Fantasy Apps Solve This

No F1 fantasy platform (official F1 Fantasy, GridRival, FantasyGP) has published technical documentation describing its storage architecture. The following is inferred from observable behavior.

### Official F1 Fantasy (fantasy.formula1.com)

The official game (operated by Genius Sports/Stats Perform) exposes per-race historical team scores in the UI and shows past team compositions. This requires per-race lineup state to have been stored. An independent data project ([github.com/JoshCBruce/fantasy-data](https://github.com/JoshCBruce/fantasy-data)) scrapes the platform to extract per-race fantasy points breakdowns per driver, confirming that scoring data is maintained per race event. No schema is public.

### GridRival

GridRival uses a **"Contracts" system** where each driver/constructor is signed for 1–5 races. Source: [GridRival Scoring Docs](https://support.gridrival.com/en/articles/4603741-f1-fantasy-points-scoring). Each contract has a defined start race and duration. This implies per-race lineup state is inherent to the data model — contract records define which elements are active for which races, making the lineup at any given race derivable from active contracts. No schema is public, but the design effectively records lineup membership implicitly through contract bounds.

---

## 3. Patterns: Options for Capturing the Lineup at Lock

### Option A — Per-Race Snapshot Table (Recommended by Industry Evidence)

A dedicated table stores the full lineup state as of each race lock deadline. One row per player slot, per team, per race. Written once at (or before) lock time; never updated afterward.

Relational sketch:
```sql
lineup_entries (
  id          uuid PRIMARY KEY,
  team_id     uuid NOT NULL,
  race_id     uuid NOT NULL,
  player_id   uuid NOT NULL,
  slot_type   text NOT NULL,    -- 'driver' | 'constructor'
  created_at  timestamptz NOT NULL
)
UNIQUE (team_id, race_id, player_id)
```

How it works: When the lock deadline fires (e.g., via a scheduled job or on-demand at first score calculation), read the team's current roster and insert rows into this table. The live roster table remains mutable; the snapshot table is write-once.

**Trade-offs:**
- Simple schema, easy to reason about and query
- Historical reconstruction is trivial — filter by `race_id`
- Scoring engine can join `lineup_entries` to race results without any replay logic
- Does not answer "what was the lineup at 2pm on race day?" — only captures state at write time
- No intent/change history (you cannot see what was swapped out before lock)
- Write volume is low: 8 rows per team per race (4 drivers + 4 constructors)

**Infrastructure fit:** Fully compatible with PostgreSQL on Supabase. No additional services needed.

**Scoring engine note:** This table is exactly what a scoring engine needs — join `lineup_entries` to a `race_results` table on `player_id` + `race_id` to compute points. Design the schema with this join in mind even before building the engine.

---

### Option B — Temporal Tables (SCD Type 2)

Every change to a team's roster creates a new row with `valid_from` and `valid_to` timestamps. The lineup at lock time is reconstructed by querying for rows active at the lock deadline:

```sql
WHERE valid_from <= lock_deadline
  AND (valid_to IS NULL OR valid_to > lock_deadline)
```

**Trade-offs:**
- Preserves every roster change — you can reconstruct the lineup at any moment in time
- More complex queries; requires careful handling of the lock boundary
- PostgreSQL does not natively support SQL:2011 system-versioned temporal tables — requires trigger-based simulation or an ORM extension
- EF Core Migrations would need custom triggers or a third-party temporal library

**Infrastructure fit:** Works on PostgreSQL but requires more schema complexity. No additional services.

**Scoring engine note:** The scoring engine would need to run the temporal query to derive the lock-time lineup for each race rather than reading from a simple snapshot table. More logic in the scoring layer.

---

### Option C — Event Sourcing / Append-Only Change Log

All roster changes are stored as events in an append-only log: `DriverAdded`, `DriverRemoved`, `ConstructorSwapped`, etc. The lineup at lock time is reconstructed by replaying all events with `occurred_at <= lock_deadline`.

Sources: [Martin Fowler — Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) · [Azure Architecture Center — Event Sourcing](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) · [microservices.io](https://microservices.io/patterns/data/event-sourcing.html)

**Trade-offs:**
- Complete audit history — every change is preserved with business intent
- Enables temporal queries and retroactive rule corrections
- Significantly more complex architecture; "permeates the entire architecture" — [Artium.ai analysis](https://artium.ai/insights/event-sourcing-when-is-it-right-to-use)
- Replay performance degrades with large event counts (mitigated with periodic materialized snapshots — see [Kurrent: Snapshots in Event Sourcing](https://www.kurrent.io/blog/snapshots-in-event-sourcing))
- High migration cost in/out of this pattern
- **Not known to be used by any major fantasy sports platform** for lineup management

**Infrastructure fit:** Works on PostgreSQL but adds significant architectural complexity. No additional services needed for a simple append-only log variant.

**Scoring engine note:** The scoring engine would need to replay events to derive lineup state per race, adding meaningful complexity. In practice this would likely lead to materializing snapshots anyway.

---

### Option D — Audit Log (Lightweight)

A change log table records before/after column-level diffs whenever a roster is modified. The primary roster table remains mutable (current state). Scoring reads from the current roster at lock time using a triggered ETL step.

This is lighter than full event sourcing — no business event semantics, just column diffs for compliance/debugging. The audit log is not used for scoring.

**Trade-offs:**
- Simpler than Option C
- Useful for dispute resolution ("you changed your lineup at 11:52am, 8 minutes before the deadline")
- Does not replace a snapshot for scoring — you still need a mechanism to write the lock-time state
- On its own, not sufficient to meet the business requirement; must be combined with a snapshot write step

---

## 4. Alternatives to Snapshotting

### A. Lock-Time ETL Trigger

Keep the team roster as a live mutable table. At the moment the lock deadline fires, run a job (scheduled task, database trigger, or API-triggered process) that reads the current roster and inserts it into a scored-lineup table. This is functionally Option A but triggered externally rather than on each submission.

**Consideration:** Reliability of the trigger matters. If the scheduled job misses a deadline (server restart, deployment, race condition), the snapshot is not captured. This is a real operational risk.

### B. Change-Event Log + Replay (Lighter Event Sourcing)

Store every add/drop as a plain insert-only row in a changes table (no full CQRS). To reconstruct the lineup at lock time, replay rows with `occurred_at <= lock_deadline`. No separate snapshot table is written.

This is essentially a simplified form of Option C without the architectural overhead. The tradeoff is that every score calculation requires a replay query rather than a simple table read.

### C. GridRival-style Contract Bounds

Rather than snapshotting, define each driver/constructor selection as a "contract" with an explicit start race and end race. Lineup at any given race is derived from which contracts are active at that race. This replaces snapshots with structured selection records that inherently encode the temporal bounds of each pick.

This is a fundamentally different data model and would require significant rethinking of how the team builder works. It also eliminates per-race editing flexibility (a contract must be defined for multiple races upfront).

### D. "Best Ball" / Auto-Lineup (Not Applicable Here)

Some DFS formats eliminate the lineup lock problem entirely by computing the optimal starting lineup post-facto. Only roster membership at lock time is needed. This does not fit the F1 Fantasy model where slot assignments (which driver occupies which slot) may carry scoring implications.

---

## 5. What Other Platforms Do Not Use

Based on publicly available evidence:

- **Event sourcing** — not known to be used by any major fantasy sports platform for lineup management. The consensus from engineering literature is that it is over-engineered for this problem unless regulatory audit trails or retroactive rule changes are required.
- **Temporal tables (SCD Type 2)** — no major fantasy platform has documented use of this pattern for lineup storage. The complexity of temporal queries at lock time does not offer advantages over a simple snapshot insert.
- **Real-time streaming infrastructure (Kafka/Flink) for lineup capture** — FanDuel uses Kafka/Flink for _scoring_ (processing incoming stat events), not for lineup capture. These are separate concerns. Adding a message broker solely to capture lineup snapshots would be significant infrastructure over-investment for this scale.

---

## 6. Considerations for Your Decision

| Factor | Notes |
|---|---|
| **Simplicity** | Option A (snapshot table) is the most straightforward to implement, test, and maintain. |
| **Scale** | At current scale (small user count, 20–24 races/year), any option works. Option A's write volume is trivially small. |
| **PostgreSQL on Supabase** | All options work. Temporal tables require custom triggers; everything else is standard SQL. |
| **Infrastructure cost** | Options A, B, C, D all add zero additional infrastructure. Streaming alternatives (Kafka) would not be justified at this scale. |
| **Operational risk** | If using a triggered ETL (Alternative A), reliability of the trigger process is critical. Snapshotting on each save/submission and overwriting is safer. |
| **Scoring engine readiness** | Option A produces the cleanest input for a future scoring engine: a flat `(team_id, race_id, player_id)` table that joins directly to race results. |
| **Auditability** | If you ever need to resolve a dispute ("my lineup was set correctly before the deadline"), none of the pure snapshot options preserve intermediate change history. A lightweight audit log can complement Option A if this matters. |

---

## Summary

The industry evidence — most clearly from FPL's public API — converges on **Option A: a per-race snapshot table written at lock time**. It is the simplest pattern, fits the existing stack without additional infrastructure, scales without complexity, and produces exactly the data shape a scoring engine will need. No major fantasy sports platform is documented as using event sourcing or temporal tables for this problem.

The main implementation decision is **when the snapshot is written**: on each roster save (overwriting the previous snapshot for that race), or as a one-time write at the lock deadline. Writing on each save is more resilient to missed jobs or race conditions and is how FPL appears to work (picks are always current until the deadline, then frozen).

---

## Sources

- [FPL APIs Explained — Oliver Looney](https://www.oliverlooney.com/blogs/FPL-APIs-Explained)
- [Fantasy Premier League API Endpoints — Frenzel Timothy (Medium)](https://medium.com/@frenzelts/fantasy-premier-league-api-endpoints-a-detailed-guide-acbd5598eb19)
- [Fantasy Premier League API — Postman](https://www.postman.com/fplassist/fpl-assist/documentation/zqlmv01/fantasy-premier-league-api)
- [fpl Python Library Docs](https://fpl.readthedocs.io/en/latest/classes/user.html)
- [Modeling a Scalable Fantasy Football Database with DynamoDB — AWS](https://aws.amazon.com/blogs/database/modeling-a-scalable-fantasy-football-database-with-amazon-dynamodb/)
- [How FanDuel Adopted Amazon Redshift — AWS Big Data Blog](https://aws.amazon.com/blogs/big-data/how-fanduel-adopted-a-modern-amazon-redshift-architecture-to-serve-critical-business-workloads/)
- [DraftKings Engineering — Medium](https://medium.com/draftkings-engineering)
- [DraftKings Fantasy Contest Rules & Scoring](https://help.draftkings.com/hc/en-us/articles/4405229758867-Fantasy-Sports-Contest-Rules-Scoring-Overview-US)
- [Event Sourcing — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)
- [Event Sourcing Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Event Sourcing vs Audit Log — Kurrent](https://www.kurrent.io/blog/event-sourcing-audit)
- [Snapshots in Event Sourcing — Kurrent](https://www.kurrent.io/blog/snapshots-in-event-sourcing)
- [Temporal Tables vs. Event Sourcing — Event-Driven.io](https://event-driven.io/en/temporal_tables_and_event_sourcing/)
- [Fantasy Sports Engine Architecture — Arka Softwares](https://www.arkasoftwares.com/blog/fantasy-sports-engine-architecture-core-modules/)
- [GridRival F1 Fantasy Points & Scoring](https://support.gridrival.com/en/articles/4603741-f1-fantasy-points-scoring)
- [Fantasy Premier League Data — vaastav (GitHub)](https://github.com/vaastav/Fantasy-Premier-League)
- [fantasy-data F1 Fantasy Scraper — JoshCBruce (GitHub)](https://github.com/JoshCBruce/fantasy-data)
- [Pattern: Event Sourcing — microservices.io](https://microservices.io/patterns/data/event-sourcing.html)
- [Temporal Tables and Time Travel in Modern SQL — Medium](https://medium.com/@CodeWithHannan/temporal-tables-and-time-travel-in-modern-sql-databases-64f1394eb13b)
- [Event Sourcing: When Is It Right to Use — Artium.ai](https://artium.ai/insights/event-sourcing-when-is-it-right-to-use)
- [ESPN Fantasy Football API v3 — Steven Morse](https://stmorse.github.io/journal/espn-fantasy-v3.html)
