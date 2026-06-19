# #256 — Isolate the standings widget's failure on Home

**Issue:** #256 — "Composed surfaces blank entirely on a single widget's failure"
**Related:** ADR 008 (section vs block surfaces), ADR 006 (TanStack Query cross-route reads), #249, #251, #254, #278, #223, #302

## Problem

The authed Home loader (`indexRoute`) fetches its widgets with `Promise.all`, which rejects as a unit. One transient failure of `getMyStandings()` throws the whole loader and Home renders its route `errorComponent` instead of the surface — a single `/me/standings` 500 discards a page the user could otherwise mostly see.

## Outcome

A standings failure degrades only the leagues widget; the identity header, score cards, and next-race card still render, and the widget shows its own error with a retry that re-fetches **only** standings. The reads that determine identity (`getTeamSummary`) still fail the route.

## Scope

- **In:** the Home leagues widget — move `getMyStandings()` out of the loader into a component `useQuery`.
- **Out (unchanged):** `getTeamSummary()` stays loader-awaited as the identity gate — a transient failure throws the route (do **not** regress #249; `summary === null` remains the no-team signal). `getRaceWeekends()` stays loader-awaited — a races failure still blanks Home, deferred to #278 (read reshape) + #223 (NextRaceCard states) per ADR 008. `myTeamRoute` / `teamRoute` are block pages, out of scope.

## Key decisions (the why, derived in the design session)

| Decision | Why |
| --- | --- |
| Standings → component `useQuery`, not `allSettled` in the loader | `useQuery` gives render isolation **and** per-widget `refetch()`. `allSettled` isolates the render but leaves retry whole-route (#251). |
| Inline `isError` + `refetch()`, no React error boundary | One widget; `throwOnError` + `QueryErrorResetBoundary` is machinery it doesn't need. |
| Fully lazy; the widget only mounts when `summary` exists | Home renders `{!summary ? <LeaguesNeedTeamNotice/> : <MyLeaguesList/>}`, so a no-team user never fetches `/me/standings` — a structural gate, no `enabled` flag. Page paints on summary+races; standings streams in. |
| Collapse the query + states **into `MyLeaguesList`**, no new wrapper | Fewer components. `MyLeaguesList` becomes the data-owner; its old prop-based unit test moves to the integration layer (accepted trade). |
| Render **nothing** while loading — not a skeleton. | The widget resolves to one of two *structurally different* shapes — a row list (has leagues) or the `JoinLeaguesPrompt` card (no leagues) — so the layout isn't predictable at load time. `web/CLAUDE.md` reserves skeletons for predictable layouts, so a row-skeleton would mispredict the card outcome (and a card-skeleton the list); "nothing" makes no shape claim, so neither outcome jumps. It's clean here because the leagues widget is Home's **last** section — content fills in at the bottom, reflowing nothing above. Warm SPA returns (60s `staleTime` + cache persistence) render instantly, so the blank slot is cold-load-only. If verification shows a slow `/me/standings` leaving the slot blank too long, the fallback is a **delay-gated, shape-neutral spinner** (per `web/CLAUDE.md`'s "shape unknown → spinner"), never a list skeleton. |
| `standingsQuery` keyed `['me','standings']`, no per-query options | Under `['me']`, so the existing `queryClient.clear()` user-switch reset (`authReactions.ts`) covers it for free. Inherits the global query defaults (`staleTime: 60s`, `retry: 1`) from `queryClient.ts` — nothing to restate. |

## Commit sequence

Each commit is a review gate and independently passes build / lint / test / format.

### Commit 1 — Isolate the standings failure

`fix(web): degrade standings widget on failure instead of blanking Home`

- **`src/services/standingsService.ts`** — add `standingsKeys = { all: ['me','standings'] as const }` and `standingsQuery = queryOptions({ queryKey: standingsKeys.all, queryFn: getMyStandings })` (no `staleTime`/`retry` — inherits the global defaults in `queryClient.ts`). `getMyStandings` is unchanged. One cold comment at the query (optional — only if it clears the bar), describing the invariant, not the change or issue: e.g. *"A failed read degrades only the leagues widget, not all of Home — so this is a query, not a loader-awaited read."*
- **`src/components/Home/MyLeaguesList.tsx`** — becomes the data-owner. `const { data, isPending, isError, refetch } = useQuery(standingsQuery)`. Branch: `isPending` → render nothing; `isError` → error (header-less); `data.length === 0` → `JoinLeaguesPrompt` (moved in from Home); else the `My Leagues` heading + `View all →` + rows.
  - **Header bound to data:** the `My Leagues` heading + `View all →` link render **only** in the has-leagues branch (with the rows) — never speculatively. Loading renders nothing, the empty state is the full `JoinLeaguesPrompt` (no header), and the error state is header-less. The header thus tracks "you have leagues," so it can't flash above — or transition out from over — the empty card.
  - **Loading:** render nothing — no skeleton (the resolved shape, list vs card, is unknown until the fetch returns; see Key decisions). The leagues widget is Home's last section, so the blank slot reflows nothing above it. Spinner fallback only if verification shows a slow fetch (see Manual verification).
  - **Error:** reuse `InlineError` (carries `role="alert"`) for a message like "Couldn't load your leagues," plus a `Button variant="outline" size="sm"` "Try again" wired to `refetch()`. No `My Leagues` heading above it, no new component, no full-page `ErrorState`.
  - Keep `role="list"` / `aria-label="My Leagues"` on the loaded list as today.
- **Manual verification** — cold-load Home (hard refresh / fresh session) as both a user **with** leagues and one **without**, and watch the leagues slot fill in. Confirm no shape jump and no header flash. If a slow `/me/standings` leaves the slot blank long enough to read as broken, add a **delay-gated, shape-neutral spinner** (`useDelayedFlag` hook, ~15 lines + test, reusable for #223) as a fast-follow; otherwise leave it as plain "nothing."
- **`src/components/Home/Home.tsx`** — drop the `standings` prop from `HomeProps`; replace the standings branch with `{!summary ? <LeaguesNeedTeamNotice/> : <MyLeaguesList/>}`. Remove the now-unused `JoinLeaguesPrompt` import (it moved to `MyLeaguesList`).
- **`src/components/IndexRoute/IndexRoute.tsx`** — stop passing `standings` to `<Home>`.
- **`src/router.tsx`** — `indexRoute` loader drops `getMyStandings()` from the `Promise.all`; returns `{ home: { summary, races } }`. Narrow the import to `getLeagueStandings` only (`getMyStandings`'s only loader use is here). Update the `indexRoute` JSDoc block (it no longer composes standings). The narrowed return type drives the `IndexRoute`/`Home` standings-prop removals above — they land together or TS fails the build.
- **`src/components/Home/Home.test.tsx`** — remove the `leagues list` and `no-leagues` describes (now integration concerns); drop `standings` from `renderHome`. Summary-present cases (identity header w/ team, score cards) now render `MyLeaguesList`, so wrap them in a `QueryClientProvider` seeded with `setQueryData(standingsKeys.all, [])` (keeps the focus on Home's header/score output). The no-team case is untouched (no `MyLeaguesList`, no provider).
- **Delete `src/components/Home/MyLeaguesList.test.tsx`** — its assertions migrate to the integration flow below.
- **`src/tests/integration/root-routing.integration.test.tsx`** — the existing home-flow suite; **update it, don't add a new file.** It currently imports `getMyStandings` and mirrors the old loader's `Promise.all([summary, standings, races])`. Update the mirrored loader to drop `getMyStandings` and return `{ home: { summary, races } }` so it matches production. **Keep the existing landing / unauthenticated case** (unaffected — anonymous visits fetch nothing), then reconcile + extend the home-flow cases:
  1. **List renders** (update the existing happy-path case) — the loader no longer carries standings; the component fetches `/me/standings`. Seed `[ranked row, null-position row]` and assert team name, score cards, next-race, and both league rows (position number **and** `—`). *(em-dash folded into the fixture, not its own case.)*
  2. **Empty** (existing no-leagues case) — `/me/standings` → `[]` → `JoinLeaguesPrompt`; header/scores still present.
  3. **Standings degrades** (new) — `/me/standings` → 500. Header + score cards + next-race render; widget shows error + "Try again".
  4. **Per-widget retry** (new) — from (3), flip `/me/standings` to succeed, click "Try again" → list renders; give the summary/races handlers a call-counter and assert it stayed at 1 (only `/me/standings` re-hit).
  5. **Summary failure throws (identity gate)** (new) — `/me/team/summary` → 500 → route error component (heading per `ErrorFallback`); the mirrored index tree wires `errorComponent: RouteErrorComponent`. Not Landing, not create-team, not a partial Home.
  6. **Profile failure tolerated** (the existing #249 guard) — `/me/profile` → 500 with `/me/team/summary` → 200 → the team Home still renders (existence reads from the summary, not the profile). Keep distinct from (5): same #249 seam, opposite outcome for a different failure — don't merge them.
  7. **No-team gate** (update the existing no-team case) — `/me/team/summary` → 404 → `LeaguesNeedTeamNotice`, and **remove its `/me/standings` handler** so strict-mode MSW fails if the widget ever fetched — the absence is the assertion.
- **MSW surface** — `/me/team/summary`, `/me/standings`, and `/seasons/{id}/race-weekends` are **not** defaults (`handlers.ts` seeds only `/me/profile`, `/me/team`, `/seasons/current`), so each case declares the ones it needs via `server.use(...)`.
- **`e2e/tests/auth.spec.ts`** (no edit, but confirm) — the "lands on home" test seeds a team with no leagues and asserts `riding solo` is visible (line 30). That text now resolves from the component `useQuery` after paint, not from the loader; Playwright's visibility auto-wait should keep it green. It's the only e2e touching this path, and nothing else it covers changes — run it (`npm run e2e` after `cd e2e/supabase && supabase start`) to confirm the timing shift didn't break it.

### Commit 2 — Doc edits

`docs: revise cache-placement and loading-state guidance in ADR 006 and web guide`

The trigger is standings moving, but the fix is general: ADR 006 and the frontend guide enumerate *which entity or code site lives where*, and that mapping is a moving boundary (standings now; drivers/constructors already via #255; race-weekends via #278). Enumerations of current identifiers rot — standings rotted in the single-route-owned list, and race-weekends is **already** stale in the reference-data list (it has no query and stays loader-fetched until #278). The rules they illustrate don't rot. So replace each inventory with its rule; keep phase/role/condition language and reasoning. This stays decision-neutral on #302 — the bare *"single-route-owned data stays on the loader cache"* rule is kept in both places, pre-committing nothing. (Distinct from the deferred read-placement-rule work below, which *articulates* the rule rather than removing inventories.)

- **`docs/adr/006-...md`** Decision, the "Adopt TanStack Query…" paragraph — drop both placement lists, keep the rules:
  - *"the shared reference data — ~~drivers, constructors, race-weekends (#255)~~ — is sequenced onto the same foundation."* (Already rotted: race-weekends are still loader-fetched — no query exists — and the read isn't reshaped until #278.)
  - *"**Single-route-owned** data — ~~leagues, league/team detail, the index route's summary/standings~~ — stays on the router's loader cache."* (Where standings rotted; `summary` genuinely stays loader-awaited, and the rule survives without the list.)
- **`docs/adr/006-...md`** Decision, the "non-obvious part" paragraph — drop the enumerations of current code sites, keep the phase/role/condition reasoning:
  - *"team is ensured in the guards' `beforeLoad` ~~(`requireTeam` / `requireNoTeam` / `teamRoute`)~~, because the whole `beforeLoad` chain runs before any loader…"* — the *why* lands without naming the guards; find-references recovers which ones.
  - *"profile is primed in `rootRoute`'s **loader** (~~its only readers are the always-on shell and the account route~~ read by the always-on shell; no guard reads it, and `rootRoute` is the one ancestor of every authed-reachable route, so it warms the shell without a flash)"* — drop the named `account route` and the exhaustive "only readers" claim (stale the moment a reader is added); keep the shell role and the "no guard reads it" justification.
  - Leave *"season is ensured in the leaf loaders that read `season.id`"* — a condition, not a name list.
- **`docs/adr/006-...md`** Consequences, the "Two caches coexist" bullet — drop the parenthetical inventory, **keep** the rule: *"…lives in the Query cache ~~(profile/team/season now, the reference data via #255)~~; single-route-owned data stays on the router loader cache."* The *"access pattern, not the entity"* thesis stays.
- **`web/CLAUDE.md`** route-owned bullet — delete the parenthetical inventory *"(league detail, standings, drivers/constructors/race weekends for a view)"* **entirely, leaving no examples** — the bullet reads `**Route-owned data** — the route's loader fetches it…`. It listed standings (moving) and drivers/constructors (already query-cached since #255); same principle, "rule not inventory."
- **`web/CLAUDE.md`** — the new **Loading-state representation** section lands here, **minus** the component-`useQuery` delay-gate clause (*"component `useQuery` skeletons must add it themselves, since `isPending` flips instantly"*). Keep the skeleton/spinner/nothing trichotomy and the route-loader delay-gate (`pendingMs`/`pendingMinMs`, already live in `router.tsx`); the dropped clause prescribes component-level delay-gate work that's deferred — it returns as a fast-follow (the `useDelayedFlag` hook) only if Manual verification shows a component loading state that needs gating (e.g. the standings spinner fallback).

## Deferred — not in this PR

- **Races isolation** — a `/race-weekends` failure still blanks Home until #278 reshapes the read and #223 gives `NextRaceCard` its four states.
- **Hardened read-placement rule** — generalizing ADR 006's thesis ("access pattern" → "how it's used") and articulating the full two-axis rule + service-catalog pointer in `web/CLAUDE.md`. Held back because writing it now would silently answer the parked question below.
- **Cache-direction decision** — issue #302 (sub-issue of #254): *does the loader cache have a principled future (the block/section split) or is it residue to migrate toward Query-as-single-cache?* Its ADR, if any, would drive that read-placement-rule doc work. #256 is correct under either outcome.
