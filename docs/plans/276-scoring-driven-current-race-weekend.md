# Fix #276 — Roster unlocks before the current race is scored

## Context

"Current race weekend" is computed under two rules. `RaceWeekendService.GetRaceWeekendsBySeasonAsync` and `GetRaceWeekendByRoundAsync` use the calendar (`RaceDate >= now`), while `GetCurrentSeasonRaceWeekendAsync` — which feeds the roster-lock guard `TeamService.GetCurrentRaceWeekendOrThrowIfLockedAsync` — uses scoring (earliest `ScoredAt == null`). While a round has run but isn't scored, the reads advance to round N+1 (UI unlocks pickers, counts down) but the guard stays on round N (every edit 409s). CONTEXT.md defines the current weekend as the earliest unscored round; this fix makes that the only rule, and gives the UI a third display phase for the run-but-unscored window — "Awaiting results" on the Home card (per the issue's copy), a race-complete banner on the Team page (commit 3).

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

**`web/src/components/LockCountdown/LockCountdown.tsx`** — props become `{ phase, lockDeadline, variant, className }` (phase computed by the parent, which needs it anyway; the component calls `useLockCountdown(lockDeadline)` itself for the ticking display). Branches on `phase`: `awaitingResults` → renders `null` for **both** variants — awaiting-results copy is owned by the consuming surface (the Home card's eyebrow now; the Team page banner in commit 3); `locked` → existing icon + "Lineup Locked"; `open` → existing label/imminent/countdown; null deadline in `open` → renders null as today.

**`web/src/components/Home/NextRaceCard.tsx`** — `const phase = useLockPhase(race.lockDeadline, race.raceDate)` in `NextRaceCardActive`; eyebrow becomes phase-driven: `Round {N} · {label}` with `{ open: 'Next up', locked: 'Current', awaitingResults: 'Awaiting results' }`; passes `phase` + `race.lockDeadline` to `LockCountdown`. No pickers here.

**`web/src/components/Team/Team.tsx`** — split line 84 into `currentRace = races.find(r => r.isCurrent) ?? null` and `displayRace = currentRace ?? races.at(-1)` (subtitle + deadline read `displayRace`). `const phase = useLockPhase(displayRace?.lockDeadline ?? null, currentRace?.raceDate ?? null)` — raceDate only for a genuinely current race. Picker gating: `readOnly={readOnly || phase !== 'open'}` replacing `isLocked` at lines ~136/139/144 (including the captain handler). Passes `phase` + deadline to `LockCountdown`. The Team tree now re-renders on phase transitions only, never per tick.

Boundary note: the third transition (awaiting → next round open) is driven by *server data* — scoring lands, the race-weekends query refetches, `isCurrent` moves. TanStack Query's refetch-on-window-focus covers it on return to the tab; only the clock-driven flips (lock, race start) need the ticker.

Durable boundaries (the two things the code can't show): a constraint comment on `clockTicker.subscribe` — read mechanism for render state only; side effects must not hang off ticks (background tabs throttle them and burst on refocus; polling belongs to TanStack Query's `refetchInterval`) — and one convention line in `web/CLAUDE.md` pointing time-derived render state at `useSyncExternalStore` + `clockTicker` with primitive snapshots. No ADR — the pattern itself is now embodied and discoverable in code.

> **Season-complete fallback:** with all rounds scored nothing is `isCurrent` and Team falls back to the last race — pass `raceDate: null` for that fallback (the deadline/raceDate asymmetry above is deliberate) so the phase caps at `locked`, preserving today's "Lineup Locked" instead of a wrong perpetual "Awaiting results". Don't design the post-final-race display here — #278 owns it and removes this fallback.

**Tests:**

- New `clockTicker.test.ts`: pins the ref-count state machine with fake timers — two subscribers share one interval (both callbacks fire per tick), unsubscribing one keeps ticking for the other, unsubscribing the last stops it (no further callbacks after timer advance), and a fresh subscribe after teardown restarts it.
- New `useLockPhase.test.ts`: the phase matrix is pure tests of `computeLockPhase` — **no fake timers**: before deadline → open; at/after deadline → locked; at/after raceDate → awaitingResults; null raceDate + past deadline → locked; null deadline + past raceDate → awaitingResults; both null → open. Plus one fake-timer `renderHook` test pinning the live transitions: advance the clock across the deadline then the race date and assert the hook's value flips open → locked → awaitingResults (pins the subscribe wiring — this is the parked-tab acceptance criterion).
- `useLockCountdown.test.ts`: countdown math survives re-targeted — days/hours/minutes decomposition and imminent become derivations from the minutes snapshot; existing fake-timer countdown → imminent progression stays; lock/phase assertions move out to `useLockPhase.test.ts`.
- `LockCountdown.test.tsx`: switches from `makeState` to props (`phase`, `lockDeadline`). Add awaitingResults: both variants render an empty DOM.
- `NextRaceCard.test.tsx`: assert "Next up" in the open test; add locked (eyebrow "Current" + "Lineup Locked") and awaitingResults (eyebrow "Awaiting results", no lock copy at all — hero suppression).
- `Team.test.tsx`: inline `mockRaces.raceDate` is `'2024-03-09'` (past — would flip existing tests to awaitingResults); move it to the future for open-phase tests. Drop the picker `vi.mock`s and render the real pickers (plain props; add/edit affordances are `{!readOnly && ...}`; nothing fires network without interaction; `QueryClientProvider` already wrapped) — per web/CLAUDE.md, don't mock children to test wiring. Gating assertions target the user-visible affordance: add-driver/add-constructor controls present when open, absent when locked/awaiting. Add: locked → affordances absent + "Lineup Locked"; awaitingResults → affordances absent and no lock copy at all; season-complete fallback → "Lineup Locked" (pins the raceDate-null cap).
- `root-routing.integration.test.tsx`: its `RACE_WEEKENDS` fixture has `raceDate: '2026-05-31'` — already past against the real clock (that file uses no fake timers), so the new phase logic would silently render Home in the awaiting-results state. Assertions happen not to break, but bump `raceDate` to a far-future date past its `'2099-01-01'` lockDeadline (e.g. `'2099-01-03'`) so those tests keep exercising the open phase deliberately. `league-membership.integration.test.tsx` serves `[]` race weekends — unaffected.
- No changes to `createMockRaceWeekend` (default raceDate `'2030-06-01'` stays open-phase). No e2e changes — "Lineup Locked" remains the locked-phase copy asserted by `e2e/tests/team.spec.ts`.
- Implementation sanity check: confirm the API serializes `raceDate` with a timezone designator (`...Z`) — `Date.parse` on a zoneless string assumes local time, which would shift the awaiting-results flip by the client's UTC offset. It rides the same `DateTime` serialization path as `lockDeadline`, which the existing countdown already parses correctly in production, so this is a verify-not-build item.

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## Commit 3 — `feat(web): race-complete banner on the team page`

After commit 2 the Team page shows nothing about the awaiting-results state (the sticky bar's status corner renders empty). This commit gives the page its awaiting surface: a full-width banner between the sticky bar and the pickers, per the approved mockup (option E) — the state explains itself and what happens next instead of a terse status string. The bar corner deliberately stays empty in this phase; a corner status would be redundant with the banner.

**New `web/src/components/Team/RaceCompleteBanner.tsx`** (co-located with its only consumer, like `Home/NextRaceCard.tsx`):

- Props: `{ raceName: string; nextRound: number | null }`.
- Layout: flex row, checkered chip + copy block; `bg-muted/70 border rounded-[0.65rem]` (same radius as NextRaceCard's card), padding ~`px-3.5 py-3`, gap 3.
- Chip: `<span aria-hidden>` ~20×15px, rounded-sm, bordered, checkered via a CSS conic-gradient over `currentColor` (`conic-gradient(currentColor 90deg, transparent 90deg 180deg, currentColor 180deg 270deg, transparent 270deg)`, `background-size` half the chip) — theme-adaptive with no asset or icon dependency.
- Copy: title `{raceName} complete — results are being scored` (`text-sm font-semibold`); sub `Your lineup reopens for Round {nextRound} once points are in.` (`text-xs text-muted-foreground`). The sub line is omitted when `nextRound` is null — the final race has no next round, and the post-season display is #278's problem.

**`web/src/components/Team/Team.tsx`** — when `phase === 'awaitingResults'`, render the banner between the sticky bar and the pickers. That phase is only reachable with a genuinely current race (the season-complete fallback passes `raceDate: null`, capping at `locked`), so `currentRace` is non-null there. Next round comes from the position after `currentRace` in the round-ordered races list: `races[races.indexOf(currentRace) + 1]?.round ?? null`.

**Tests** (through `Team.test.tsx` — the banner is presentational and its only consumer already has the fixture; a direct component test would be all setup):

- awaitingResults → banner title ("Saudi Arabian Grand Prix complete — results are being scored") and "reopens for Round 3" rendered; edit affordances still absent. Fixture grows a second, future round-3 race.
- awaitingResults on the last race in the list → title rendered, no "reopens" line.
- open and locked → no banner copy.
- season-complete fallback → no banner copy ("Lineup Locked" assertion from commit 2 stays).

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## Commit 4 — `fix(web): align clock ticks to wall-clock seconds`

Hardening from the lock-display review. `setInterval(…, 1000)` phases off whatever moment the first subscriber mounts, so a minute rollover or phase flip is noticed up to ~1s after the true boundary. Production deadlines are whole-hour timestamps (`api/supabase/seed.sql`), so ticks aligned to wall-clock seconds land exactly on every flip instant — the lag drops from ≤1s to timer-fire jitter.

**`web/src/lib/clockTicker.ts`** — replace the interval with a chained timeout aligned to the next second boundary: each fire schedules the next via `setTimeout(tick, 1000 - (Date.now() % 1000))` *before* notifying (a throwing listener can't kill the chain), then fans out. Recomputing the remainder each fire self-corrects drift and realigns after background-tab throttling. Teardown clears the *latest* pending timeout id — unlike an interval id, it changes on every fire. The `visibilitychange` notify stays as-is; correctness on refocus never depended on tick cadence.

**Tests:**

- `clockTicker.test.ts`: pin `vi.setSystemTime` explicitly — the schedule now depends on time-of-day, and Vitest's fake clock defaults to the real `Date.now()`, so an unpinned start makes tick timing nondeterministic. The ref-count/fan-out tests carry over. Add one alignment test: subscribe mid-second (e.g. `…T12:00:00.400Z`) and assert the first notification lands at the next whole second, not 1000ms after subscribing.

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## Commit 5 — `refactor(web): one clock read for lock phase and countdown`

Revises commit 2's two-hook split. As shipped, phase and countdown derive from two separate `Date.now()` reads in two components, and `useLockCountdown`'s `Math.max(0, …)` clamp makes `lockingImminently` true forever past the deadline with `remaining` stuck at zeros — the display is right only because `LockCountdown`'s phase branches shadow those values. Reordering the branches, or consuming `lockingImminently` on a new surface without the phase guard, would show "Less than 1 minute" indefinitely post-lock. Merging onto one read per surface makes the invalid states unrepresentable instead of hidden.

**New `web/src/hooks/useLockState.ts`** (replaces `useLockPhase.ts` + `useLockCountdown.ts`, both deleted):

```ts
export type LockState =
  | {
      phase: 'open';
      remaining: { days: number; hours: number; minutes: number } | null;
      lockingImminently: boolean;
    }
  | { phase: 'locked' }
  | { phase: 'awaitingResults' };
```

- Pure exported `computeLockState(lockDeadline, raceDate, now)` keeps `computeLockPhase`'s precedence — raceDate checked before deadline, so `awaitingResults` wins even with a null deadline.
- getSnapshot reads `Date.now()` **once** and returns a primitive string — `'locked'`, `'awaitingResults'`, `` `open:${minutes}` `` with a deadline, `'open:'` without one — so `Object.is` keeps re-renders coupled to displayed-value changes (commit 2's house rule survives the merge). The hook parses the snapshot into the union; the `remaining` decomposition and `lockingImminently` (`minutes === 0`, deadline present) are pure math on the parsed value.
- With one `now`, `phase === 'open'` implies `now < deadline`, so minutes are non-negative by construction — the clamp and the states it manufactured are gone.
- Reading `remaining` requires narrowing to the `'open'` arm — misuse is a compile error, not a branch-ordering convention.

**`web/src/components/LockCountdown/LockCountdown.tsx`** — becomes a pure leaf: props `{ state: LockState; variant; className }`, no hook, no clock. Rendering is unchanged (awaitingResults → null, locked → "Lineup Locked", open → imminent/countdown, open with null `remaining` → null), but each branch now renders values that can only exist in that phase.

**`web/src/components/Home/NextRaceCard.tsx`** — `const lockState = useLockState(race.lockDeadline, race.raceDate)` in `NextRaceCardActive`; eyebrow keys off `lockState.phase`; passes `state` to the leaf. The `LockPhase` type import moves to `LockState['phase']`.

**`web/src/components/Team/Team.tsx`** — `useLockState(displayRace?.lockDeadline ?? null, currentRace?.raceDate ?? null)`, arg-for-arg with today's call; `editable` and the banner key off `.phase`. The season-complete fallback now yields a bare `{ phase: 'locked' }` — its latent perpetual `lockingImminently: true` disappears with the clamp.

Accepted trade-off: the surfaces re-render once per minute while the phase is open (previously confined to the leaf). The pass is a few hundred fiber nodes committing a single text node, and any picker growth heavy enough to change that verdict shows up first on interaction paths (captain click, sheet open) where it's loud and profilable — the minute tick can't be the first symptom.

**Tests:**

- New `useLockState.test.ts`: `computeLockState` ports the full pure matrix — the eight phase boundary cases from `useLockPhase.test.ts`, the day/hour/minute decompositions from `useLockCountdown.test.ts` (asserted on the open arm), open with no deadline → `remaining: null`, under a minute → `lockingImminently: true`, and at/past deadline → bare `locked` arm (no countdown fields exist to leak). One fake-timer `renderHook` test keeps the live open → locked → awaitingResults flip. `useLockPhase.test.ts` and `useLockCountdown.test.ts` go with their hooks.
- `LockCountdown.test.tsx`: pure props, drops fake timers entirely; the "no deadline" case becomes the open arm with null `remaining`.
- `NextRaceCard.test.tsx` / `Team.test.tsx`: assertions unchanged — they pin DOM outcomes (eyebrows, "Lineup Locked", banner, affordances) through the real hook. NextRaceCard keeps its fake-timer setup; Team keeps pinning phases with fixed past/future fixture dates against the real clock.

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## Commit 6 — `fix(web): correct and owner-gate the awaiting-results banner`

Three small, independent fixes from the lock-display review, grouped because each is a few lines and two of them land in `Team.test.tsx`. Independent of commits 4–5.

**Finding #1 — the banner stops claiming the race is "complete."** `computeLockPhase` flips to `awaitingResults` at `now >= raceDate`, which is the race *start*, not its finish, so `{raceName} complete` is wrong copy for the whole time the race is running (the whole race day for date-only timestamps).

`web/src/components/Team/RaceCompleteBanner.tsx` → **rename to `web/src/components/Team/AwaitingResultsAlert.tsx`** (the name now matches the "Awaiting Results" copy and the shadcn `Alert` primitive it renders):

- Rename the component `RaceCompleteBanner` → `AwaitingResultsAlert` and its props type `RaceCompleteBannerProps` → `AwaitingResultsAlertProps`.
- Title becomes the static `Awaiting Results`; swap the hand-rolled checkered `<svg>` icon for lucide `<Timer />` (`import { Timer } from 'lucide-react'`).
- `raceName` is now unused in the component — drop it from `AwaitingResultsAlertProps` and the destructure.
- Description is unchanged (`Your lineup reopens for Round {nextRound} once results are in.` / `Results are being scored.`). The reopens-promise-accuracy problem (finding #3) is a separate fix, not folded in.

`web/src/components/Team/Team.tsx`:

- Update the import (line 20) to `import { AwaitingResultsAlert } from './AwaitingResultsAlert'` and the JSX tag (line 133) to `<AwaitingResultsAlert …>`.
- Remove the now-dead `raceName={currentRace.name}` argument from that call (~line 134).

**Finding #2 — the banner is owner-only.** Its copy is possessive ("Your lineup reopens…"); on a read-only view of another user's team during the awaiting window it narrates the viewer's own lineup state on someone else's page.

`web/src/components/Team/Team.tsx`:

- Gate the render on `!readOnly` (~line 132): `{!readOnly && phase === 'awaitingResults' && currentRace && (…)}`.
- Consequence, accepted here: a read-only team in the awaiting window shows no lock indicator (the sticky-bar corner is already empty then — `LockCountdown` returns null for `awaitingResults`). The viewer can't edit a rival's lineup, so there's nothing owner-neutral to add; restoring a "Lineup Locked" line for the read-only awaiting case is a display decision left out of scope.

**Finding #11 — the test drops its hand-rolled `RaceWeekend` mock.** `Team.test.tsx`'s local `makeRaces` helper (lines 14–34) duplicates `createMockRaceWeekend` from `@/tests/test-utils` — whose defaults this branch already updated for the new phase semantics — and returns a one-element array callers immediately destructure.

`web/src/components/Team/Team.test.tsx`:

- Delete `makeRaces`; import `createMockRaceWeekend` (alongside the existing `createMock*` imports) and call it directly. It returns a single `RaceWeekend`, so wrap in `[…]` where `renderWithRaces` wants an array, and replace `const [currentRace] = makeRaces({…})` / `const [nextRace] = makeRaces({…})` (~lines 120, 124) with plain `const currentRace = createMockRaceWeekend({…})`. Keep the `import type { RaceWeekend }` — `renderWithRaces`'s signature still uses it.
- The factory's defaults differ from the helper's (round 5 / "Spanish Grand Prix" / future locked deadline vs round 2 / "Saudi Arabian Grand Prix" / null deadline). Adopt the factory defaults rather than re-encoding the old ones — that's the point of the finding: update the subtitle assertion at ~line 90 from `'Round 2 · Saudi Arabian Grand Prix'` to `'Round 5 · Spanish Grand Prix'`. Call sites that need a specific round/date already pass explicit overrides and carry over unchanged. In the awaiting-results test, pass `round: 2` on the current race so it stays below the next race's `round: 3` (the factory's default of 5 would invert the order the `indexOf`-based next-round lookup reads).

**Banner-copy tests (also `web/src/components/Team/Team.test.tsx`):**

- The two awaiting-results tests assert `getByText('Saudi Arabian Grand Prix complete')` (~lines 134, 145) — retarget both to `getByText('Awaiting Results')`. The description assertions ("… reopens for Round 3 …", "Results are being scored.") are unchanged.
- Add a read-only awaiting case via the existing helper: `renderWithRaces([createMockRaceWeekend({ raceDate: <past>, lockDeadline: <past> })], { readOnly: true })`; assert the banner is absent (`queryByText('Awaiting Results')` and `queryByText(/reopens for Round/)` both null) and edit affordances are absent.

**Verify:** `npm run web:test`, `npm run web:lint`, `npm run web:format:check`, `npm run web:build`.

## End-to-end verification

After all five commits, against the dev stack (`npm run api:watch` + `npm run web:dev`). The dev database is already seeded — **do not insert new rows**; set up each state by updating existing ones. Put the earliest unscored round N into the run-but-unscored window (`UPDATE` its `RaceDate` to the past; leave `ScoredAt` null). Team page shows round N with the race-complete banner ("… complete — results are being scored" / "Your lineup reopens for Round N+1 once points are in."), the bar's status corner empty, pickers hidden; Home card eyebrow reads "Round N · Awaiting results" with the hero lock status suppressed. Set round N's `ScoredAt` (or score it through the app), refresh: round N+1 is current and editable before its deadline. For the live flip, set round N's `RaceDate` a minute ahead and leave the tab open — it flips to awaiting results without a refresh. After commits 4–5, also navigate between Home and the team page around a minute boundary and confirm both show the same countdown value on arrival. Restore any adjusted dates afterward.
