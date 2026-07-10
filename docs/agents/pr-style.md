# PR writing

How to write pull request titles and bodies for this repo.

Keep the body lean: include only what the diff, CI, the linked issue, and the commit messages don't already carry. Put anything you want acted on — a constraint, a convention, the intent behind an odd line — in the commit message, a code comment, or CLAUDE.md, not the body.

## Title

Imperative. No conventional-commit prefix. ≤70 characters. What, not how.

## Body

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

## Style

- Imperative, present tense, plain. No business jargon.
- Be concise. One concern per PR.
- Describe the state, not the diff or the history.
- Link, don't repeat.
