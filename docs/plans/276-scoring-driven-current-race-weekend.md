# Fix #276 — Roster unlocks before the current race is scored

## Context

"Current race weekend" is computed under two rules. `RaceWeekendService.GetRaceWeekendsBySeasonAsync` and `GetRaceWeekendByRoundAsync` use the calendar (`RaceDate >= now`), while `GetCurrentSeasonRaceWeekendAsync` — which feeds the roster-lock guard `TeamService.GetCurrentRaceWeekendOrThrowIfLockedAsync` — uses scoring (earliest `ScoredAt == null`). While a round has run but isn't scored, the reads advance to round N+1 (UI unlocks pickers, counts down) but the guard stays on round N (every edit 409s). CONTEXT.md defines the current weekend as the earliest unscored round; this fix makes that the only rule, and gives the UI a third display phase ("Awaiting results") for the run-but-unscored window, per the copy specified in the issue.

Out of scope: contract reshape / dropping `isCurrent` / by-round endpoint removal (#278), NextRaceCard loading states (#223), onboarding during the window (#160).

## Commit 1 — `fix(api): select current race weekend by scoring rule everywhere`

This commit alone kills the bug's damage: `isCurrent` holds on the just-run round, so the existing `isLocked` gating disables pickers and no edit path reaches the 409.

**New: `api/F1CompanionApi/Domain/Services/CurrentRaceWeekendSelector.cs`** — pure static class modeled on `StandingsRanker.cs` / `LeagueStandingsBuilder.cs`:

```csharp
public static class CurrentRaceWeekendSelector
{
    public static RaceWeekend? GetCurrentRaceWeekend(IEnumerable<RaceWeekend> raceWeekends) =>
        raceWeekends.Where(r => r.ScoredAt == null).OrderBy(r => r.Round).FirstOrDefault();
}
```

**`api/F1CompanionApi/Domain/Services/RaceWeekendService.cs`** — consolidate all three sites onto the scoring rule (the two list-holding sites call the selector; the by-round read only swaps its query predicate — don't refactor a dead endpoint further):

- `GetRaceWeekendsBySeasonAsync` (~line 54): replace the `RaceDate >= now` pick with the selector over its already-materialized list; keep passing the id into `ToResponseModel` (mapper stays decision-free).
- `GetRaceWeekendByRoundAsync` (~line 76): swap the second query's predicate to `r.SeasonId == seasonId && r.ScoredAt == null` (keep `OrderBy(Round)`). Nothing more — the endpoint has no production callers; removal is #278.
- `GetCurrentSeasonRaceWeekendAsync` (~line 107): load the current season's weekends with `ToListAsync()`, return the selector result (~24 rows; fine on the write path). Contract unchanged.
- `TeamService.GetCurrentRaceWeekendOrThrowIfLockedAsync` — untouched.

**Tests:**

- New `api/F1CompanionApi.UnitTests/Services/CurrentRaceWeekendSelectorTests.cs` (pure xUnit, entity factory helper per `StandingsRankerTests.cs`): none scored → lowest round (feed out of order); some scored → earliest unscored (scored round 3 with unscored round 2 → 2); all scored → null; empty → null; ignores `RaceDate` (past-date unscored round 1 beats future-date round 2).
- `api/F1CompanionApi.UnitTests/Services/RaceWeekendServiceTests.cs`: delete the three date-rule tests (`...MarksCurrentRaceWeekend_WhenRaceIsUpcoming` ~240, `...MarksNoCurrentRaceWeekend_WhenAllRacesHavePassed` ~302, `GetRaceWeekendByRoundAsync_MarksRaceAsCurrent_WhenRaceIsNextUpcoming` ~492). Keep the rule-agnostic rest. No InMemory replacements — api/CLAUDE.md forbids extending that pattern.
- `api/F1CompanionApi.IntegrationTests/Scenarios/CurrentRaceWeekendTests.cs`: keep `OnlyConsidersCurrentSeason` and `NoCurrentSeason_ReturnsNull` (season-resolution failure modes only integration can see) plus `FirstScored_ReturnsSecond` as the one representative pinning load+select through real SQL; drop `AllWeekendsUnscored_ReturnsFirstByRound` and `AllScored_ReturnsNull` — they re-walk the selector branch matrix now owned by the unit tests (overlap rule: branches live at the lowest layer). Add one HTTP-seam test owning read/guard agreement (`RunButUnscoredRound_StaysCurrentAndLocked_UntilScored`): seed current season, round 1 run+locked+unscored (`raceDate` −1d, `lockDeadline` −2d), round 2 future (+6d/+5d), team + driver via `TestDataBuilder`; assert `GET /api/seasons/{id}/race-weekends` marks round 1 current and `POST /api/me/team/drivers` → 409; set round 1 `ScoredAt` via `WithDbAsync` (don't re-drive the scoring endpoint); assert round 2 now current and the write → 204. Lock-deadline behavior itself stays owned by `LineupLockTests` — don't duplicate.

**Verify:** `npm run api:test` (Docker required), `npm run api:format:check`.

## Commit 2 — `fix(web): three-phase lock display driven by race date`

Design principle (per react.dev): wall-clock time is a value outside React that changes without its knowledge — read it with `useSyncExternalStore`, not a hand-rolled `useState`+`setInterval` effect ("You Might Not Need an Effect" labels the effect-subscription version "not ideal"). With a **primitive** snapshot, `Object.is` guarantees a component re-renders *only when its displayed value changes* — render frequency is coupled to display granularity mechanically, not by timer cleverness. Phase (changes twice, consumed page-level for picker gating) and countdown (changes per minute, consumed only by the leaf) are split so each surface subscribes at its own granularity.

**New `web/src/lib/clockTicker.ts`** — the shared ref-counted ticker (module-level store, same placement pattern as `authStore.ts`). One global `Set` of listeners; `subscribe(callback)` adds to the set, and on the 0→1 transition starts a single `setInterval(..., 1000)` plus a `visibilitychange` listener (instant correction on tab refocus after background throttling); the returned cleanup removes the callback and tears both down when the set empties. Each tick fans out to all listeners. Ticks are cheap: each one just recomputes a primitive snapshot; React skips rendering unless it changed. Every snapshot reads the real clock, so sleep/throttling self-correct — lateness can only delay a flip, never show a wrong phase.

**New `web/src/hooks/useLockPhase.ts`** —

```ts
export type LockPhase = 'open' | 'locked' | 'awaitingResults';

export function computeLockPhase(lockDeadline: string | null, raceDate: string | null, now: number): LockPhase {
  if (raceDate != null && now >= Date.parse(raceDate)) return 'awaitingResults';
  if (lockDeadline != null && now >= Date.parse(lockDeadline)) return 'locked';
  return 'open';
}

export function useLockPhase(lockDeadline: string | null, raceDate: string | null): LockPhase {
  return useSyncExternalStore(subscribe, () => computeLockPhase(lockDeadline, raceDate, Date.now()));
}
```

String snapshot → the page re-renders exactly twice over the whole window (at lock, at race date). No stop conditions, no overflow guards, no effect deps on derived state. (No `getServerSnapshot` — SPA, no SSR.)

**`web/src/hooks/useLockCountdown.ts`** — slims to countdown-only and moves *inside* the `LockCountdown` leaf. Snapshot is a single number — whole minutes remaining until the deadline (`null` when no deadline): `Math.floor((deadline - now) / 60_000)` clamped at ≥ 0. `{days, hours, minutes}` and `lockingImminently` (`minutesRemaining === 0` while unlocked) are derived from it at render — pure math, no extra state. Per-second renders disappear entirely; the leaf re-renders once a minute, and only while it's showing a countdown.

**`web/src/components/LockCountdown/LockCountdown.tsx`** — props become `{ phase, lockDeadline, variant, className }` (phase computed by the parent, which needs it anyway; the component calls `useLockCountdown(lockDeadline)` itself for the ticking display). Branches on `phase`: `awaitingResults` → hero variant renders `null` (the eyebrow carries the copy), compact renders "Awaiting results" (statusText styling, no `Lock` icon, no "Lineup" label); `locked` → existing icon + "Lineup Locked"; `open` → existing label/imminent/countdown; null deadline in `open` → renders null as today. Per-variant branching lives here — the component already has a per-variant style table.

**`web/src/components/Home/NextRaceCard.tsx`** — `const phase = useLockPhase(race.lockDeadline, race.raceDate)` in `NextRaceCardActive`; eyebrow becomes phase-driven: `Round {N} · {label}` with `{ open: 'Next up', locked: 'Current', awaitingResults: 'Awaiting results' }`; passes `phase` + `race.lockDeadline` to `LockCountdown`. No pickers here.

**`web/src/components/Team/Team.tsx`** — split line 84 into `currentRace = races.find(r => r.isCurrent) ?? null` and `displayRace = currentRace ?? races.at(-1)` (subtitle + deadline read `displayRace`). `const phase = useLockPhase(displayRace?.lockDeadline ?? null, currentRace?.raceDate ?? null)` — raceDate only for a genuinely current race. Picker gating: `readOnly={readOnly || phase !== 'open'}` replacing `isLocked` at lines ~136/139/144 (including the captain handler). Passes `phase` + deadline to `LockCountdown`. The Team tree now re-renders on phase transitions only, never per tick.

Boundary note: the third transition (awaiting → next round open) is driven by *server data* — scoring lands, the race-weekends query refetches, `isCurrent` moves. TanStack Query's refetch-on-window-focus covers it on return to the tab; only the clock-driven flips (lock, race start) need the ticker.

Durable boundaries (the two things the code can't show): a constraint comment on `clockTicker.subscribe` — read mechanism for render state only; side effects must not hang off ticks (background tabs throttle them and burst on refocus; polling belongs to TanStack Query's `refetchInterval`) — and one convention line in `web/CLAUDE.md` pointing time-derived render state at `useSyncExternalStore` + `clockTicker` with primitive snapshots. No ADR — the pattern itself is now embodied and discoverable in code.

> **Season-complete fallback:** with all rounds scored nothing is `isCurrent` and Team falls back to the last race — pass `raceDate: null` for that fallback (the deadline/raceDate asymmetry above is deliberate) so the phase caps at `locked`, preserving today's "Lineup Locked" instead of a wrong perpetual "Awaiting results". Don't design the post-final-race display here — #278 owns it and removes this fallback.

**Tests:**

- New `clockTicker.test.ts`: pins the ref-count state machine with fake timers — two subscribers share one interval (both callbacks fire per tick), unsubscribing one keeps ticking for the other, unsubscribing the last stops it (no further callbacks after timer advance), and a fresh subscribe after teardown restarts it.
- New `useLockPhase.test.ts`: the phase matrix is pure tests of `computeLockPhase` — **no fake timers**: before deadline → open; at/after deadline → locked; at/after raceDate → awaitingResults; null raceDate + past deadline → locked; null deadline + past raceDate → awaitingResults; both null → open. Plus one fake-timer `renderHook` test pinning the live transitions: advance the clock across the deadline then the race date and assert the hook's value flips open → locked → awaitingResults (pins the subscribe wiring — this is the parked-tab acceptance criterion).
- `useLockCountdown.test.ts`: countdown math survives re-targeted — days/hours/minutes decomposition and imminent become derivations from the minutes snapshot; existing fake-timer countdown → imminent progression stays; lock/phase assertions move out to `useLockPhase.test.ts`.
- `LockCountdown.test.tsx`: switches from `makeState` to props (`phase`, `lockDeadline`). Add awaitingResults per variant: hero → empty DOM; compact → "Awaiting results", no "Lineup Locked", no lock icon.
- `NextRaceCard.test.tsx`: assert "Next up" in the open test; add locked (eyebrow "Current" + "Lineup Locked") and awaitingResults (eyebrow "Awaiting results", no lock copy at all — hero suppression).
- `Team.test.tsx`: inline `mockRaces.raceDate` is `'2024-03-09'` (past — would flip existing tests to awaitingResults); move it to the future for open-phase tests. Drop the picker `vi.mock`s and render the real pickers (plain props; add/edit affordances are `{!readOnly && ...}`; nothing fires network without interaction; `QueryClientProvider` already wrapped) — per web/CLAUDE.md, don't mock children to test wiring. Gating assertions target the user-visible affordance: add-driver/add-constructor controls present when open, absent when locked/awaiting. Add: locked → affordances absent + "Lineup Locked"; awaitingResults → "Awaiting results" + affordances absent; season-complete fallback → "Lineup Locked", not "Awaiting results".
- `root-routing.integration.test.tsx`: its `RACE_WEEKENDS` fixture has `raceDate: '2026-05-31'` — already past against the real clock (that file uses no fake timers), so the new phase logic would silently render Home in the awaiting-results state. Assertions happen not to break, but bump `raceDate` to a far-future date past its `'2099-01-01'` lockDeadline (e.g. `'2099-01-03'`) so those tests keep exercising the open phase deliberately. `league-membership.integration.test.tsx` serves `[]` race weekends — unaffected.
- No changes to `createMockRaceWeekend` (default raceDate `'2030-06-01'` stays open-phase). No e2e changes — "Lineup Locked" remains the locked-phase copy asserted by `e2e/tests/team.spec.ts`.
- Implementation sanity check: confirm the API serializes `raceDate` with a timezone designator (`...Z`) — `Date.parse` on a zoneless string assumes local time, which would shift the awaiting-results flip by the client's UTC offset. It rides the same `DateTime` serialization path as `lockDeadline`, which the existing countdown already parses correctly in production, so this is a verify-not-build item.

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## End-to-end verification

After both commits, against the dev stack (`npm run api:watch` + `npm run web:dev`). The dev database is already seeded — **do not insert new rows**; set up each state by updating existing ones. Put the earliest unscored round N into the run-but-unscored window (`UPDATE` its `RaceDate` to the past; leave `ScoredAt` null). Team page shows round N, compact status "Awaiting results", pickers hidden; Home card eyebrow reads "Round N · Awaiting results" with the hero lock status suppressed. Set round N's `ScoredAt` (or score it through the app), refresh: round N+1 is current and editable before its deadline. For the live flip, set round N's `RaceDate` a minute ahead and leave the tab open — it flips to awaiting results without a refresh. Restore any adjusted dates afterward.
