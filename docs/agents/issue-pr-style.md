# Issue & PR writing

How to write issue and PR bodies for this repo.

## Issues

### Title

Lead with a verb, or state the symptom. ~6–10 words. No conventional-commit prefix. Make it specific enough to recognise in a backlog; put detail in the body. Name one concern.

| Off-the-cuff          | Template-shaped                                    |
| --------------------- | -------------------------------------------------- |
| `fix: lock bug`       | `Lineup picker stays editable after lock deadline` |
| `Countdown`           | `Add live countdown to lineup lock deadline`       |
| `Issue with leagues`  | `Private league invite link returns 404`           |
| `feat: scoring stuff` | `Add captain multiplier to scoring engine`         |

### Body

Each part below is its own `##` section header. Include a section only when it has real content.

- **`## Problem`** — state the gap as a problem, not a solution: _When &lt;situation&gt;, &lt;what happens&gt; — which is a problem because &lt;impact&gt;._
- **`## Outcome`** — give the resolved state in one line.
- **`## Acceptance criteria`** — list the checkable conditions that prove the outcome; map each to a test or an observation.
- **`## Scope`** — state what's in and what's explicitly out.
- **`## Pointers`** — link relevant files, docs (`docs/research/…`, `docs/adr/…`), related issues.
- **`## Reproduction`** (bugs only) — give numbered steps, then **Expected**, **Actual**, **Environment**.

## Pull requests

Keep the body lean: include only what the diff, CI, the linked issue, and the commit messages don't already carry. Put anything you want acted on — a constraint, a convention, the intent behind an odd line — in the commit message, a code comment, or CLAUDE.md, not the body.

### Title

Imperative. No conventional-commit prefix. ≤70 characters. What, not how.

### Body

Under **`## Summary`**, give 1–2 sentences of the why that isn't visible in the diff, plus `Closes #N`. Add a section below only when it has real content:

- **`## Verification`** — give the checks that left no artifact (e.g. a browser check against the dev stack). Don't list the automated tests.
- **`## Risk & scope`** — name a genuine risk, a shortcut taken, or something deliberately left out, with a pointer. Don't restate the commit messages.

Small fix:

```
Title: Fix lap-count off-by-one in sprint scoring

## Summary
Sprint laps were counted 0-indexed; F1 rounds are 1-indexed, so points landed on
the wrong driver. Closes #142.
```

Larger change:

```
Title: Persist standings instead of recomputing per request

## Summary
Standings were recomputed on every /me/standings call, which got slow once leagues
filled up. Now materialized on score ingest. Closes #51.

## Verification
Manually checked the leaderboard against the dev stack after ingesting a full race
weekend — matches the old recompute path. Materialization math is unit-tested.

## Risk & scope
Backfill migration runs once over existing seasons; idempotent upsert, safe to re-run
if it fails midway. Doesn't touch sprint scoring — that's #58.
```

## Shared style

- Imperative, present tense, plain. No business jargon.
- Be concise. One concern per artifact.
- Describe the state, not the diff or the history.
- Link, don't repeat.
