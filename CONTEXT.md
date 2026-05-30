# Glossary

Canonical terms for the F1 Fantasy App. When code, UI copy, tests, or docs name a domain concept, use the term defined here.

## Season total points

A team's cumulative points across **every scored race in the current season**, regardless of which leagues the team belongs to. Source of truth: `SUM(TeamRaceWeekendScore.TotalPoints)` for the team within the season.

Distinct from **league total points** — a team's season total is league-independent.

## League total points

A team's cumulative points **within a single league**. Source of truth: the latest `TeamLeagueStanding.TotalPoints` row for `(LeagueId, TeamId)`.

Diverges from the team's season total whenever the team joined the league after Round 1 — the league total only accumulates from the round the team became a member. No back-fill.

Never refer to a single number as "total points" without qualifying which one — they are not the same quantity.

## Home

The authed landing surface at `/`. Aggregates cross-domain state (team identity, next race, season/last-race scoring, leagues) so that no single-purpose page has to smuggle in cross-domain summaries. The unauthed view at `/` remains the marketing landing page; the authed view is the Home.

## Team summary

A point-in-time rollup of how the team is performing in the current season — currently the [[season total points]] and the team's score in the most recently scored race. Served by `GET /me/team/summary`. Distinct from [[league total points]], which is per-league.

Both fields are nullable: a team that exists but has not yet had a scored race in the current season has neither a season total nor a last-race score.

## My league standing

The caller's position and total points within a specific league — the caller-scoped projection of `TeamLeagueStanding`. Served by `GET /me/standings`, which returns one row per league the caller belongs to: `{ leagueId, leagueName, totalTeams, position: int?, totalPoints: int? }`. The row entity is a *standing*, not a league — league metadata (name, totalTeams) is denormalized in for rendering convenience. `position` and `totalPoints` are nullable until the caller's team has a scored race in the current season while a member of that league. See [[league total points]] for why per-league totals can diverge from [[season total points]].

## No-team state

A signed-in user who has not yet created a team for the current season — the earliest point in the onboarding progression. Distinct from the [[No-leagues state]] (team exists, no league joined) and the [[No-scored-races state]] (team in a league, nothing scored yet). The [[Home]] surface renders a dedicated no-team variant: the identity header drops the team name, and the score and leagues areas give way to a create-team prompt and a gated-leagues notice.

## No-leagues state

A team that belongs to no league. Distinct from the [[No-team state]] (no team at all) and the [[No-scored-races state]] (team has leagues, nothing scored yet). The [[Home]] surface renders the full layout with the leagues list replaced by a join-or-create-a-league prompt.

## No-scored-races state

A team that exists in the current season but has not yet had a scored race. Distinct from "no team yet" — the team exists and belongs to leagues; nothing has been scored yet. The [[Home]] surface renders the same layout as the scored state, with `—` em-dashes in score-bearing positions (the Last-race and Season cards' big number; the league rows' position and points columns). No "0 pts" placeholders — `0` is a real scoring outcome (DNFs, no points-finishers) and must not be conflated with "not yet scored."
