# F1 Fantasy

Fantasy F1 platform where users build teams, join leagues, and earn points from real race results. When code, UI copy, tests, or docs name a domain concept, use the term defined here.

## Language

### Game structure

**Season**:
A competition year, mapping to an F1 calendar year and containing that year's race weekends as ordered rounds. Driver and constructor prices are set per season.

**Race weekend**:
One round of a season — the event teams earn points from. Comes in two formats: standard (qualifying → race) and sprint (sprint → qualifying → race).
_Avoid_: "race" for the whole event — the race is the Sunday session within the weekend

**Current race weekend**:
The race weekend a team is currently playing: the earliest unscored round of the current season. It advances when scoring completes, not when the grand prix runs — a weekend that has run but is awaiting results is still current, and when every round is scored the season is complete and there is no current weekend.
_Avoid_: "next race" / "upcoming race" — those read as the next calendar date, which diverges during the awaiting-results window

**Team**:
A user's fantasy entry for a season — a named identity that fields a lineup and earns points from scored races. Each user fields exactly one team per season.

**Lineup**:
The set of drivers and constructors a team fields.
_Avoid_: "roster" — not a concept in this app

**Lineup lock**:
The freeze on lineup changes once the current race weekend's lock deadline passes: drivers and constructors cannot be added or removed until the weekend is scored.

**Budget cap**:
The spending limit a lineup's combined driver and constructor prices must stay within, the same for every team. A lineup that exceeds it is invalid.

**League**:
A group of teams competing against each other; a team can belong to multiple leagues, and a league that has reached its team cap is full. Public leagues are open to browse and join; private leagues are joinable only by invite.

**League invite**:
A shareable credential that grants access to join a specific private league; each league has a single permanent token that never expires or rotates. A valid invite can still be unjoinable when the league is full.
_Avoid_: "expired" invite — there is no expiry in the model; a token that resolves to no league is an invalid invite

### Points & standings

**Season total points**:
A team's cumulative points across every scored race in the current season, independent of league membership.
_Avoid_: "total points" unqualified — always say whether the season or league total is meant

**League total points**:
A team's cumulative points within a single league, accumulating only from the round the team joined — no back-fill. Diverges from the season total whenever the team joined after Round 1.
_Avoid_: "total points" unqualified

**Team summary**:
A point-in-time rollup of a team in the current season: its name, season total points, and most-recent scored-race score. The two score parts are absent for a team with no scored race yet; the name is always present.

**League standing**:
A team's position and league total points within a single league it belongs to. Both are absent until the team has a scored race while a member of that league.

**My league standing**:
The league standing of the signed-in user's team; one exists per league the team belongs to.

### Home

**Home**:
The authed landing surface at `/`, aggregating cross-domain state: team identity, current race weekend, scoring summaries, and leagues. The unauthed view at `/` is the marketing landing page, not Home.

**No-team state**:
A signed-in user who has not yet created a team for the current season — the earliest point in the onboarding progression.

**No-leagues state**:
A team that belongs to no league. Distinct from the no-team state (no team at all) and the no-scored-races state (leagues joined, nothing scored yet).

**No-scored-races state**:
A team that exists in the current season (and may belong to leagues) but has no scored race yet. Not-yet-scored is distinct from scoring zero — `0` is a real outcome (DNFs, no points-finishers), never a placeholder for "not yet scored."
_Avoid_: "0 pts" as a placeholder for a team with nothing scored yet
