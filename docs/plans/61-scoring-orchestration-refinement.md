# Scoring Orchestration (Issue #61) — Refinement Notes

Working document capturing decisions made while refining the acceptance criteria
for issue #61. This is not yet a full implementation plan — it's a record of the
questions that have been settled and the ones still open.

## Dependencies

- **#57 Scoring Engine** — merged. Provides `ScoreRaceEntitiesAsync` and
  `ScoreTeamsForRaceAsync`, both idempotent via delete-and-reinsert.
- **#12 Race → SeasonRace refactor** — merged. Entity is now `RaceWeekend`.
- **#63 API key auth for ingestion** — **#61 now depends on this.** See Q2.

## Decisions so far

### Q1 — Trigger mechanism (settled)

The ingestion script (`api/scripts/ingest_results.py`) orchestrates the sequence.
The .NET API exposes per-step endpoints; each does exactly one thing.

- `PUT .../results/{session}` — ingest one session's results (unchanged from
  today).
- `POST .../score` — idempotently scores whatever session data is currently in
  the DB. Called after every session ingest (qualifying, sprint, grand-prix).
- `POST .../advance-lineups` — copies the team lineups to Round N+1. Called **only**
  after a successful grand-prix ingest + score.

Updated Python script flow, per round:

```
submit quali    → POST score
(if sprint)
  submit sprint → POST score
submit GP       → POST score → POST advance-lineups
```

**Why per-session scoring:** players should see scores update after each
session (quali points visible before the race runs, etc.). The existing scoring
service reads whatever session data exists and scores it — partial weekends
score correctly as zeros for unrun sessions.

**Why script-as-orchestrator, not server-side auto-trigger:** keeps each HTTP
endpoint single-purpose. Each call returns a clean success/failure for one
concern. If scoring fails after a successful ingest, the script reports it and
the operator re-runs only that step. No "ingest succeeded but scoring failed"
ambiguity in a single response.

**Why advance-lineups is its own endpoint:** re-scoring a round after FIA
corrections should not re-trigger advance-lineups (Round N+1 may already have user
edits). Keeping advance-lineups as a separate, deliberately-called step avoids
accidental clobbering.

**GP completion detection:** the script processes sessions in order; the GP
branch (`ingest_results.py:415-426`) is the last step. Trigger point is "right
after the GP `submit_results(...)` call returns 200" (inside the existing
`if payload:` branch at line 423-424).

### Q2 — Auth on scoring and advance-lineups endpoints (settled)

**#61 is dependent on #63.** Once #63 ships:

- #63 adds an `ApiKeyAuthenticationHandler` and an `"ApiKeyOnly"` policy
  (machine-to-machine shared-secret auth via `X-Api-Key` header).
- The script drops Supabase user auth and sends `X-Api-Key` instead.

For #61, the new endpoints simply apply `.RequireAuthorization("ApiKeyOnly")`.
The script already has the header wired up, so adding the two new POST calls
(`score`, `advance-lineups`) requires no additional auth changes on either side.

Update issue #61: replace `Blocked by: #12` with `Blocked by: #63`.

### Q3 — Empty lineup at Round N lock (settled)

Teams with zero `LineupEntry` rows at Round N lock are skipped by advance-lineups.
This isn't a special case — copying 0 rows from N produces 0 rows at N+1, which
is what a straightforward `INSERT ... SELECT FROM LineupEntry WHERE
RaceWeekendId = N` already does.

Nudging users who never set a lineup is an onboarding-UX concern, out of scope
for #61.

### Q4 — Re-scoring interaction with advance-lineups (settled)

Re-scoring and advance-lineups are fully decoupled:

- **Re-scoring Round N** (`POST .../score`) never touches Round N+1. Scoring
  and advance-lineups are separate endpoints, and the script only calls advance-lineups
  once, after the initial GP ingest+score.
- **`advance-lineups` is idempotent at the team level.** The endpoint copies N → N+1
  only for teams that have zero `LineupEntry` rows at N+1. Teams with any
  existing N+1 rows (whether from an untouched `advance-lineups` or from post-transfer edits) are
  skipped.

### Q5 — `advance-lineups` timing (settled)

**Firing point:** immediately after the GP's `POST .../score` returns success,
from the script, inside the existing `if payload:` branch at
`ingest_results.py:423-424`. Already fixed by Q1 — no additional trigger
points.

**Behavior when N+1's lock deadline has already passed:** the endpoint refuses
with a clear error surfacing the round and lock time. No post-lock writes.

**Why refuse:** the lock deadline means N+1's lineup is frozen. `advance-lineups`
writing `LineupEntry` rows to a locked round would violate that invariant —
and if N+1 has also already been scored, it would silently change what a
re-score of N+1 produces. The endpoint stays narrow: it only operates on
unlocked rounds.

**When this edge case fires, it's an ops issue, not an endpoint behavior to automate.**
An `advance-lineups` call arriving after N+1's lock means ingest is badly
behind schedule; the fix is operator intervention (manual backfill, adjusting
the lock, etc.), not a silent post-lock write. The endpoint's job is to
refuse cleanly and surface the state.

### Q6 — Scoring endpoint shape (settled)

`POST .../score` is a single endpoint that internally calls
`ScoreRaceEntitiesAsync` and then `ScoreTeamsForRaceAsync` in sequence. The
two service methods are not separately exposed.

**Why one endpoint:** team scores are derived from entity scores — the two
always run together in the ingestion flow. Splitting the endpoint would push
ordering responsibility onto the script for a constraint that's really a
property of the domain. Q1's "single purpose" principle is satisfied at the
operator-facing grain: "score this race" is one concept.

**Failure semantics:** entities run first; if that step fails, teams is not
attempted and the error is returned. If entities succeed and teams fails, the
response surfaces both so the operator knows a retry is safe (both methods
are idempotent via delete-and-reinsert).

**Extensibility:** if an admin-tooling scenario later needs "recompute team
scores only" (e.g., after a manual lineup correction), that can be added as
a separate, explicitly-named endpoint at that point. Not needed now.

### Q7 — End-of-season advance-lineups (settled)

When Round N is the final round of the season there is no N+1 to advance
into. The endpoint detects this case and returns a distinct, non-error
response indicating the season has ended and no rows were written.

**Why a distinct response rather than silent success:** the script reports
per-step outcomes. A silent success would look identical to a real copy,
making the script's output misleading at season end. A specific signal keeps
the operator's log honest.

### Q8 — Failure observability (settled)

Acceptance bar is "operator reads script output / API logs." No additional
alerting, Sentry hooks, or monitoring are in scope for this issue — the
script is run manually by a solo operator, who will see any failure
immediately in the terminal.

### Q9 — Bulk / backfill re-score (settled)

Deferred. If scoring logic ever needs correcting after ship, N manual calls
is acceptable at current scale. No bulk endpoint in scope.

## Decisions resolved by existing decision docs

From a review of `docs/research/fantasy-rules/decisions/`:

- **`advance-lineups` scope:** drivers, constructors, and captain all carry forward by
  default. `rules.md` §Race Cancellation establishes captain stickiness
  ("Captain selections persist unless the player changes them"); the transfer
  model in §Transfers presumes a persistent lineup the player mutates.
- **No budget check on advance-lineups:** `rules.md` §Budget Cap explicitly allows a
  team's total market value to exceed the cap as prices appreciate — remaining
  balance only changes through transactions. A carried lineup that now exceeds
  the cap due to price drift is allowed.
- **`advance-lineups` timing constraint:** transfers for Round N+1 open before its
  lock, and transfers require a lineup to mutate. `advance-lineups` must therefore run
  before N+1's transfer window opens for users — practically, as soon as
  possible after Round N's GP scoring completes.

## Acceptance criteria

### `POST .../score` endpoint

- [ ] Endpoint exists, gated by the `ApiKeyOnly` policy (from #63).
- [ ] Entity scores are computed before team scores.
- [ ] If entity scoring fails, team scores are not computed and the error is
      returned.
- [ ] On partial failure, the response distinguishes which step failed
      (entity vs. team) so the operator knows whether a retry is safe.
- [ ] Idempotent: re-running against already-scored session data produces
      identical row counts and values with no duplicates.

### `POST .../advance-lineups` endpoint

- [ ] Endpoint exists, gated by the `ApiKeyOnly` policy.
- [ ] Copies drivers, constructors, and captain from Round N to Round N+1.
- [ ] Per-team idempotent: teams with any existing `LineupEntry` rows at N+1
      are skipped; only teams with zero N+1 rows are copied.
- [ ] Refuses (no rows written) when Round N+1 is already locked, with an
      error that lets the operator identify which round and when it locked.
- [ ] A carried lineup whose total value exceeds the budget cap is copied
      successfully (per `rules.md` §Budget Cap).
- [ ] When Round N is the final round of the season, returns a distinct
      end-of-season response with no rows written.

### Ingestion script (`api/scripts/ingest_results.py`)

- [ ] Calls `POST .../score` after each session ingest (qualifying, sprint
      when present, grand-prix).
- [ ] Calls `POST .../advance-lineups` once, after a successful grand-prix ingest
      + score.
- [ ] Authenticates using the `X-Api-Key` header (from #63).
- [ ] Output clearly reports success/failure per step so the operator knows
      which step to rerun on partial failure.

### Cross-cutting

- [ ] Re-scoring an already-scored round produces identical results and does
      not trigger advance-lineups.
- [ ] Automated tests cover: score idempotency, entity-fails-stops-teams,
      advance-lineups per-team idempotency, advance-lineups post-lock refusal, and the
      script's per-step success/failure reporting.

### Issue hygiene (not AC)

- Update #61 metadata: replace `Blocked by: #12` with `Blocked by: #63`.

### Out of scope (flagged for follow-up)

- **Partial-weekend UI handling** — when scores are computed mid-weekend, the
  web UI needs to display "race points = 0 because the race hasn't happened
  yet" without confusing users. Downstream concern, tracked separately.
- **Operator tooling for late-ingest recovery** — if advance-lineups ever refuses
  because N+1 has locked, manual backfill is the operator's responsibility.
  Any admin UI or endpoint to support that is a separate issue.
