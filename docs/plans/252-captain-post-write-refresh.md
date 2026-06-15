# Issue #252 — Captain goes stale after a write: unify team-write refresh on `useMutation`

## Context

Setting the captain updates local component state and calls the API but never refreshes the team query, so the cached team is stale on the next navigation — while add/remove *does* refresh. The behaviour is inconsistent.

The issue was filed before #247 landed. The current code is now:

- **Add/remove** (`useLineupPicker.ts`) already `await`s the service then `queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey })`. The "replace `router.invalidate()`" note in the issue is already done here.
- **Captain** (`TeamView.handleSetCaptain`, `Team.tsx`) does an **optimistic local-state update + rollback** and **never touches the query cache**. `captainDriverId` is a `useState` seeded once from `team.drivers.find(d => d.isCaptain)` on mount; on remount the component re-seeds from the **stale** cached team, so a captain change reverts on the next navigation.

So the literal evidence in the issue ("no `router.invalidate()`") is outdated. The real gap is (a) a missing query refresh and (b) a **dual source of truth** — `captainDriverId` local state *and* `team.drivers[].isCaptain` from the query — synced only on mount.

## Findings that emerged during grilling (beyond the issue's framing)

1. **`setCaptain` returns `Promise<void>`** (`teamService.ts:94`) — no updated team comes back, so an optimistic cache patch must be constructed locally (flip `isCaptain`), and a non-optimistic fix would need a refetch.
2. **The codebase has no `useMutation` pattern yet** — both `useLineupPicker` and `handleSetCaptain` hand-roll `await service()` + manual `invalidateQueries` + manual `isPending`/`error`. This is **not a deliberate convention**; it's where the #247 Query migration stopped. So "stay consistent with the raw pattern" carries no weight — the idiomatic target was always `useMutation`, and #252 is the natural place to introduce it.
3. **The existing `useLineupPicker.test.ts` predates the testing strategy and is implementation-coupled** in exactly the ways the strategy calls out: it `vi.mock('@tanstack/react-query')` to stub `useQueryClient` (`:17-23`), and asserts `invalidateQueries` *was called with a key* (`:181-197`, `:353-369`) — the "every refactor becomes a rewrite" smell. The `useMutation` move forces a real `QueryClientProvider` (so the library mock dies regardless) and is the moment to bring these in line.
4. **`isPending` drives real UI** — a spinner overlay (`DriverPicker.tsx:102-106`) and a **double-submit guard** (`!isPending`, `:128`). But the two unit tests asserting the *boolean transitions* (`:222-257`, `:371-406`) become library passthroughs under `useMutation` (the flag is just `mutation.isPending`). The observable behaviour they gesture at belongs in integration.
5. **The "Related" auth-event item references a symbol that no longer exists.** There is no `useInvalidateOnUserChange` in `InnerApp.tsx`; the mechanism is `resetCaches` wired in `main.tsx:61` (`initAuthStore({ onUserChange: () => resetCaches(...) })`), which `queryClient.clear()`s the whole cache on identity change. So captain state can't leak across users, and same-user auth events (token refresh) have no correctness need to invalidate the team. The flag's own "likely a no-op" prediction holds.

## Validated against the docs, not inferred

- **`useMutation` is the idiom; Router stays out.** TanStack Query owns mutations. For a write that changes a cached query: optimistic = `onMutate` (`cancelQueries` → snapshot → `setQueryData`) / `onError` rollback / `onSettled` `invalidateQueries`; non-optimistic = `onSuccess`/`onSettled: invalidateQueries`. `router.invalidate()` only re-runs loaders and `ensureQueryData` then serves the still-fresh cache — already recorded in ADR 006 and `web/CLAUDE.md`.
- **React 19 `useOptimistic` is the wrong tool here.** The React docs bind it to the form-action / `useActionState` model where **React state** is the source of truth and React auto-reverts on settle. With the Query cache owning the team, Query's own `onMutate` is the optimistic path; layering `useOptimistic` on top is two optimistic layers over the same data. React 19's relevant contribution to this stack is Suspense, which `useSuspenseQuery` already rides.
- **Custom hooks for mutations are the documented default** (encapsulation + co-location), though the docs don't mandate one for single-use and show optimistic `useMutation` inline too. Combined with the local `useLineupPicker` precedent and the testing strategy's bar for a direct hook test, this tips to a `useSetCaptain` hook.
- **`setQueryData` updates must be immutable** (return new objects/arrays) — the optimistic patch builds a new `drivers` array of new driver objects.

## Decisions (from the grilling session)

- **Scope: migrate *all* team writes to `useMutation` (scope B), not captain-only.** Captain-only would trade "captain stale" for "captain on `useMutation`, add/remove on raw async" — a mixed-mechanism window in `main`. Bundling both keeps the pattern uniform. They go in one PR as two commits.
- **Captain optimistic; add/remove non-optimistic.** The asymmetry is justified by the interaction: add/remove's request gap is masked by the picker closing, but the captain toggle is in-place — a non-optimistic captain would leave the star unmoved across two sequential round-trips (PUT then refetch GET), forcing new interim affordances (disable/spinner) just to not look broken. Optimistic captain **preserves today's behaviour** (instant move + rollback) — the optimistic write simply moves from React state into the cache — which is the *minimal behavioural change* that also fixes the staleness and the dual-source-of-truth. Add/remove stays non-optimistic (optimism there needs the full driver object + a budget recompute; not worth it, and it already feels fine).
- **`useSetCaptain` hook + a direct unit test.** Single consumer, so it's not for reuse — but the optimistic patch + rollback + `null`/toggle logic clears the testing strategy's bar for a direct hook test, and it mirrors `useLineupPicker`. Lives in `src/hooks/` (not `teamService.ts` — services stay React-free). **No** separate `withCaptain` pure helper: the hook test exercises the patch via cache state, so the helper would be redundant.
- **Bring the `useLineupPicker` tests in line (option B).** Drop the library mock (forced by `useMutation`) and the two `invalidateQueries`-was-called assertions; assert the refresh where it's *observable* — an integration test that adds a driver and sees the lineup update after refetch. Delete the two boolean `isPending`-transition unit tests (passthroughs); keep the `openPicker`-gating test (`:123-159`, a real rule the hook owns).
- **Double-submit guard pinned without timing.** Validate "two clicks → one request" deterministically with a **deferred promise + request counter** (the test holds the first request open; the second click is gated by `!isPending`), not a delayed response. This is the same `resolveAdd` technique the current unit tests already use, moved to integration where the component guard + real hook run together.
- **Drop the "Related" auth-event item** as an assessed no-op (finding 5). No separate issue.
- **No new ADR; no `CONTEXT.md` change.** This is an *application* of ADR 006, which already names "#252 (post-write refresh) becomes tractable on top" and that reads use `useSuspenseQuery` so an invalidation reactively updates them — fails the "hard to reverse" bar for a new ADR. The glossary resolved no domain term (`useMutation`/optimistic are implementation detail; "Captain" wasn't fuzzy).
- **`web/CLAUDE.md` convention note, split per commit.** The Data Loading Pattern section currently says only that a mutation "must `invalidateQueries`" — not *how*, which is why the raw pattern grew. Commit 1 adds the non-optimistic `useMutation` line (true once the `useLineupPicker` change is in place); Commit 2 extends it with the optimistic `onMutate` line (true once the captain change is in place). Splitting keeps every commit's doc matching its code — no window where the convention is established but undocumented, and no doc ahead of code.

## Approach

Two self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. **Migrate add/remove to `useMutation`** (non-optimistic) and bring `useLineupPicker`'s tests in line.
2. **Fix the captain** via a new optimistic `useSetCaptain` hook.

**Two commits, not three.** Neither subdivides cleanly: Commit 1's refactor and its test rewrite are inseparable (the moment `useLineupPicker` uses `useMutation`, the library-mock tests break), and splitting Commit 2 into hook-then-consumer would make the first commit introduce a fully-tested hook nobody calls. The one defensible third commit — characterization-tests-first on Commit 1 (the refresh + double-submit integration tests pass against today's raw-async code, so they *could* be committed before the refactor as a safety net) — is deliberately **declined** as more ceremony than this scope earns.

**Order is pattern-first.** The commits are independent in code (Commit 2 doesn't import Commit 1's changes); they're unified by one goal — uniform team-write mechanism — plus the `web/CLAUDE.md` thread that runs 1→2. Establish the pattern in the low-risk, not-broken flow first (+ document it), then apply it to fix the bug.

---

## Commit 1 — Migrate add/remove to `useMutation`, align tests

### `web/src/hooks/useLineupPicker.ts`

Replace the hand-rolled `try/catch` + `setIsPending` + manual `invalidateQueries` in `handleAdd`/`handleRemove` with two `useMutation`s (or one keyed on the operation). Keep the **public API identical** (`pool`, `selectedPosition`, `isPending`, `error`, `openPicker`, `closePicker`, `handleAdd`, `handleRemove`) so `DriverPicker`/`ConstructorPicker` and the surviving tests don't churn:

- `isPending` ← `addMutation.isPending || removeMutation.isPending`.
- `error` ← keep the friendly mapped string (`Failed to add ${itemType}. Please try again.`), set in `onError`, cleared on `openPicker` and at the start of each `mutate`. Preserve the Sentry `logger.error` calls.
- Each mutation's `onSuccess`: `queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey })`. Non-optimistic — behaviour unchanged.
- Keep `closePicker`/`selectedPosition` reset semantics, including the **asymmetry**: today `setSelectedPosition(null)` runs in `handleAdd`'s `finally` (picker closes on add success **and** error) but **not** in `handleRemove`. Replicate it via add's mutation `onSettled` (or both `onSuccess`/`onError`); do **not** fold it into a shared handler that would also reset on remove.

### `web/src/hooks/useLineupPicker.test.ts`

- **Remove** the `vi.mock('@tanstack/react-query')` stub (`:17-23`); wrap `renderHook` in a real `QueryClientProvider` (a fresh `QueryClient` per test, retries off).
- **Delete** the two `invalidates the team query after successful add/remove` tests (`:181-197`, `:353-369`) — implementation assertions; the observable refresh moves to integration (below).
- **Delete** the two `sets isPending during add/remove operation` tests (`:222-257`, `:371-406`) — `isPending` is now a `mutation.isPending` passthrough.
- **Keep** `pool` filtering, the error-message mapping (incl. `itemType` variants), and `does not open picker when operation is pending` (`:123-159`) — genuine hook-owned behaviour, no library mock.

### `web/src/tests/integration/team-lineup.integration.test.tsx`

- **New — add refreshes the lineup:** add a driver via the picker; MSW serves the POST `204` and a follow-up `GET /me/team` reflecting the added driver; assert the lineup now shows it. This is the observable form of the deleted unit assertions.
- **New — no double-submit (deterministic, no timing):**

  ```tsx
  it('does not fire a second add while one is in flight', async () => {
    let resolveAdd!: () => void;
    let addCount = 0;
    server.use(
      ...teamHandlers(team),
      http.post(`${API_BASE}/me/team/drivers`, async () => {
        addCount++;
        await new Promise<void>((r) => (resolveAdd = r)); // held by the test, not a timer
        return new HttpResponse(null, { status: 204 });
      }),
    );
    // open picker, click a pool item twice
    expect(addCount).toBe(1); // second click gated by !isPending
    resolveAdd();             // release + settle
  });
  ```

  Deterministic: after the first `await user.click`, React has flushed and `isPending` is `true`, the sheet is still open (it closes on settle, which is held), so the second click hits the `selectedPosition !== null && !isPending` guard and never calls `mutate`. The guarantee rests on the **request counter + click ordering**, not on observing the spinner — the overlay (`DriverPicker.tsx:102-106`) has no role/testid, and `web/CLAUDE.md` forbids CSS-class selectors, so don't try to `waitFor` it.

### `web/CLAUDE.md` — Data Loading Pattern

Extend the existing mutation sentence with the mechanism (non-optimistic half only):

> Writes that change a query-cached resource use `useMutation` — reconcile via `invalidateQueries` in `onSuccess`/`onSettled`. Don't hand-roll `await service()` + manual invalidate.

---

## Commit 2 — Fix the captain via optimistic `useSetCaptain`

### `web/src/hooks/useSetCaptain.ts` (new)

```tsx
import type { Team } from '@/contracts/Team';
import { myTeamQuery, setCaptain } from '@/services/teamService';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useSetCaptain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setCaptain, // (driverId: number | null) => Promise<void>
    onMutate: async (driverId) => {
      await queryClient.cancelQueries({ queryKey: myTeamQuery.queryKey });
      const previous = queryClient.getQueryData<Team | null>(myTeamQuery.queryKey);
      queryClient.setQueryData<Team | null>(myTeamQuery.queryKey, (team) =>
        team
          ? { ...team, drivers: team.drivers.map((d) => ({ ...d, isCaptain: d.id === driverId })) }
          : team,
      );
      return { previous };
    },
    onError: (_err, _driverId, context) => {
      queryClient.setQueryData(myTeamQuery.queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: myTeamQuery.queryKey }),
  });
}
```

`driverId === null` (clear captain) flips every driver to `false`; the click-the-current-captain-to-toggle-off case is resolved by the caller (`DriverPicker` passes `null`). The patch is immutable (new array, new driver objects).

### `web/src/components/Team/Team.tsx` — `TeamView`

- `const captainMutation = useSetCaptain();`
- Replace the `captainDriverId` `useState` (`:69`) with a derived read: `const captainDriverId = team.drivers.find((d) => d.isCaptain)?.id ?? null;`. The optimistic `onMutate` patch updates the cache, so `useSuspenseQuery` re-renders and this derived value moves the star immediately; rollback reverts it.
- Delete the `captainError` `useState` (`:72`); drive the `InlineError` from `captainMutation.error` (preserve the current message: the thrown error's `message`, else `'Failed to update captain'`). Clear is implicit — a new `mutate` resets `error`.
- `handleSetCaptain` → `(driverId) => captainMutation.mutate(driverId)`; keep the existing `readOnly || isLocked ? undefined : ...` gating on `onSetCaptain`.

### `web/src/hooks/useSetCaptain.test.ts` (new) — unit

Seed a real `QueryClient` with a team; mock `setCaptain` to resolve/reject. **Isolate the service via `vi.mock('@/services/teamService')` with `importActual` so `myTeamQuery`/`teamKeys` stay the production values** — otherwise the optimistic patch writes a different `queryKey` than the hook reads, and the assertions pass against a phantom cache entry. (Same `importActual` trick `useLineupPicker.test.ts` uses today for the query lib.) Assert **cache state**, not that `setQueryData` was called:

- After `mutate(driverId)`, `getQueryData(myTeamQuery.queryKey)` has exactly that driver `isCaptain: true`, others `false` (optimistic, before settle).
- `mutate(null)` clears all `isCaptain`.
- Toggle: a team whose captain is X, `mutate(null)` → none captained.
- Immutability: the patched team and `drivers` are new references.
- Rollback: with `setCaptain` rejecting, after settle the cache is restored to the prior snapshot.

### `web/src/tests/integration/team-lineup.integration.test.tsx`

- **New — captain survives navigation** (the #252 repro): build a two-route tree (`/my-team` + a stub sibling — copy the `buildStubRoute` pattern from `view-team`/`navigation.integration.test.tsx`). On `/my-team`, set a captain; the PUT returns `200`, and **`GET /me/team` flips to the captain'd team after the PUT** (a `captainSet` flag, mirroring the `added` flag in the add-refresh test). Navigate away and back via the returned `router.navigate({ to: ... })`; assert the new captain still renders. **Confirmed red against pre-fix code, green after** (verified by stashing the `Team.tsx` fix and re-running).
  - **Why not the originally planned "keep `GET` pre-captain throughout":** _as-implemented correction_ — that setup fails _with_ the fix, not just before it. `onSettled`'s `invalidateQueries` refetches the active `useSuspenseQuery` while still on `/my-team`, so a perpetually-stale `GET` clobbers the optimistic patch and the captain reverts on the page itself. The flipped `GET` keeps the pre-fix red intact regardless: old code never invalidates on captain, so its only `GET` is the initial pre-captain load, which `ensureQueryData` re-serves on the way back (within `staleTime`) — the remounted view re-seeds from that stale team and the captain reverts. So the repro doesn't depend on a stale `GET`; it depends on old code never writing the cache.
  - **Selector caveat:** the captain button's accessible name **flips** when set — `Set {name} as captain` → the active label (`Captain — 2× points (active)` / `aria-pressed="true"`, `DriverCard.tsx:76-80`). Assert the captained state via `aria-pressed="true"` (or the active label), **not** the inactive `/set .* as captain/i`.
- **Adapt** `surfaces an error message when setCaptain fails` (`:182-198`): with the PUT returning `500`, additionally assert the optimistic **rollback** — the button flips to the active state (`aria-pressed="true"`) then reverts to `Set … as captain` once the error settles — alongside the existing `role="alert"`. **Assert only these observables — not `getQueryData` cache state.** The cache-rollback mechanics are owned by the unit test; this layer owns the UI-reverts-and-error-shows wiring. Re-asserting cache state here re-walks the unit's matrix and turns permitted overlap into duplication.
  - **As-implemented:** observing the **flip-then-revert** deterministically needs the PUT held open — use the deferred-promise technique from Commit 1's double-submit test: assert `aria-pressed="true"` while the request is in flight, then release it as a `500` and assert the revert + `role="alert"`.

### `web/src/components/Team/Team.test.tsx` — render-wrapper fallout (not anticipated above)

`TeamView` now calls `useSetCaptain` (→ `useMutation`), so the existing `Team.test.tsx` renders (pickers mocked, no provider) throw "No QueryClient set". Wrap each render in a fresh per-test `QueryClientProvider`. (These container-with-mocked-children tests are the `web/CLAUDE.md` anti-pattern — the readOnly/lock behaviour they assert is already covered in the integration layer — but migrating or deleting them is out of scope for #252.)

### `web/CLAUDE.md` — Data Loading Pattern

Extend the Commit 1 line with the optimistic half:

> Optimistic writes additionally snapshot + `setQueryData` in `onMutate` with an `onError` rollback (see `useSetCaptain`).

---

## Out of scope / follow-ups

- **`useMutation` elsewhere** — only team writes are migrated. Other services keep their current shape until they have a reason to change.
- **Spinner-visible-during-write assertion** — the double-submit test covers the load-bearing guarantee (no duplicate request); a separate transient-visual assertion isn't worth a fussier test.
- **"Related" auth-event invalidation** — dropped as an assessed no-op (finding 5), not deferred.
