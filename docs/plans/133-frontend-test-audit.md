# Plan: Audit frontend tests and migrate journey-level cases to E2E suite (#133)

## Context

The Vitest suite (`web/src`, ~54 test files, ~614 tests) was written before the E2E layer (#131, closed) and the frontend integration layer (#134, closed) existed. With both now landed (`e2e/tests/*.spec.ts` and `web/src/tests/integration/account.integration.test.tsx` as the reference), some current page-/route-level jsdom tests sit at the wrong layer:

- A few are journey-level — mounting whole pages with mocked router + mocked context + mocked services to assert on multi-step user flows. jsdom can't honestly verify those; the real-browser E2E suite already does.
- More are multi-component wiring tests — loader + guard + component + form + mutation against a stubbed network — which now have a natural home in `src/tests/integration/`.
- The rest (leaf components, hooks, services, schemas, narrow contexts, route guards as functions) are correctly placed and stay.

Issue acceptance criteria:

1. Every page-/route-level test reviewed and classified.
2. Journey-level tests migrated to E2E with equivalent or better coverage (where E2E already covers the journey, the redundant jsdom test is deleted).
3. Multi-component wiring tests migrated to frontend integration with equivalent or better coverage.
4. No net loss of failure-mode coverage.
5. `web/CLAUDE.md` documents the three-way split so future tests land in the right place.

Scope: one issue, sequenced commits per CLAUDE.md feature-planning rule. Trim overlap aggressively — when the integration or E2E layer honestly proves the assertion, the jsdom duplicate is deleted.

## E2E migration — what actually moves

For each "delete as redundant" or "migrate to integration" call below, the question is whether the journey-level assertions in the original test are already covered by an E2E that _clicks_ the right thing (not just visits a page). After reading every E2E spec:

- **Already covered in E2E** (no E2E migration needed; original journey assertions are honestly redundant): sign-in success, sign-out, unauth redirect (`auth.spec.ts`); avatar upload (`avatar.spec.ts`); create league + invite + join via URL, unauth signup→createTeam→join (`league.spec.ts`); sign-up→createTeam, edit lineup + set captain + reload-persist, lock-deadline disable (`team.spec.ts`).
- **Gaps to close in E2E before deleting/trimming jsdom** (each is a journey assertion the original jsdom test was honestly proving, with no current real-browser equivalent):
  1. **Browse public leagues → join from list → land on league detail.** `BrowseLeagues.test.tsx` (lines 168–346) walks the full path: list renders, "Join" button enabled for public leagues, confirm dialog opens, joinLeague service called, navigates to `/league/$id`. `league.spec.ts` only covers join-_via-invite-URL_, which is a different code path (no list, no confirm dialog). See Commit 3.
- **Considered and skipped** (not journey-level enough to warrant E2E; integration or unit is honest):
  - **Landing-page CTA → `/sign-up`.** Originally proposed for E2E; on review, the handler is a one-line `navigate({ to: '/sign-up' })` with no loader, guard, or async. Every other spec exercises the same router/route via `page.goto('/sign-up')`, so a CTA-click E2E proves nothing those don't already prove. The "coverage" being lost from `LandingPage.test.tsx` was itself a shallow click-and-route-change assertion; deleting it without replacement is honest.
  - JoinInvite full-league alert (stubbed state — integration territory).
  - SignInForm/SignUpForm error UI on bad creds (real-browser error injection is awkward; integration with MSW is honest).
  - (Originally considered: Team readOnly view at `/team/$teamId` — confirmed shipped route with no integration/E2E coverage; resolved by adding a single integration test in Commit 5.)
  - `/account` displayName edit + reload-persist — `avatar.spec.ts` proves the route + persistence layer; integration covers the submit shape.
- **Stays at unit level** (form validation, pristine-state behavior, accessibility): SignInForm/SignUpForm Zod messages, Account form pristine-tracking, picker container accessibility. These are not journey assertions; E2E migration would be over-investment.

## E2E coverage already in place (baseline for "what's redundant")

From `e2e/tests/`:

- **auth.spec.ts** — sign-in → leagues dashboard; unauth `/my-team` redirects to landing; sign-out clears session.
- **avatar.spec.ts** — `/account` avatar upload persists URL, propagates to sidebar.
- **league.spec.ts** — User A creates private league, User B joins via invite URL; unauth visitor to `/join/$token` signs up → creates team → joins.
- **team.spec.ts** — new user signs up → creates team → lands on `/my-team`; edit lineup within budget + set captain + reload (persist); past lock deadline disables pickers.

Integration reference already in place: `web/src/tests/integration/account.integration.test.tsx` (real `/account` loader → component → MSW success/500).

## Audit (file-by-file classification)

| File                                                          | Lines | Action                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------- | ----- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.test.tsx`                                           | 71    | **Delete**                                 | All deps mocked; asserts only that DOM exists. Zero failure modes covered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/InnerApp.test.tsx`                                       | 279   | **Keep as unit**                           | Tests render-time gate logic (loading → router → overlay) given hook state. Setup proportional to assertions. State-machine logic, not multi-component wiring. Leave alone.                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/lib/route-guards.test.ts`                                | 418   | **Keep as unit**                           | Guards called as functions with synthetic context; correct layer. Integration covers guard-attached-to-route wiring separately.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/components/Account/Account.test.tsx`                     | 638   | **Extract `<AccountForm />` + migrate**    | Account already composes AvatarUpload + form + display block, so extracting the form has independent design value (not test-driven). Move loader/500 path coverage to `account.integration.test.tsx` (already exists). Test form mechanics (pristine, dirty-tracking, validation, accessibility) at the unit layer against `<AccountForm profile onSubmit />`. Delete `Account.test.tsx`.                                                                                                                                                                            |
| `src/components/LandingPage/LandingPage.test.tsx`             | 178   | **Delete**                                 | Static-JSX assertions (headings, feature copy, "Learn More" scroll) per the existing `web/CLAUDE.md` do-not-test list. The CTA-click assertion is a one-line `navigate({ to: '/sign-up' })` with no loader/guard/async — every other spec exercises the same router/route via `page.goto('/sign-up')`, so an E2E CTA click would prove nothing those don't already prove.                                                                                                                                                                                            |
| `src/components/JoinInvite/JoinInvite.test.tsx`               | 350   | **Migrate to integration + delete**        | Mocks 6 hooks/services to assert on auth-conditional CTAs + join flow. New `join-invite.integration.test.tsx` covers preview render, auth/team-conditional CTA branches, and error branches (full-league, generic 500). JoinInvite is a route component reading from `useLoaderData` / `useRouteContext`, so no kept tests can be honestly leaf-level — delete the file. Full unauth → signup → join journey is owned by `league.spec.ts`.                                                                                                                           |
| `src/components/CreateLeague/CreateLeague.test.tsx`           | 325   | **Keep as unit**                           | Dialog/form mechanics. `league.spec.ts` owns the create-and-navigate journey. No migration needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/components/BrowseLeagues/BrowseLeagues.test.tsx`         | 611   | **Done (Commit 3): migrate + delete** | Migrated to `leagues.integration.test.tsx` (list/empty/500/join-failure branches against real router + MSW). All kept presentational assertions (badges, member-count format, dialog open/cancel, per-row scoping, accessibility) absorbed into the integration test. File deleted.                                                                                                                                                                                                                                                                                  |
| `src/components/League/League.test.tsx`                       | 235   | **Done (Commit 3): migrate + delete** | Loader/404/500 paths moved to `leagues.integration.test.tsx`. Invite-dialog flow (lazy fetch, cache, error, copy, Escape) moved to new `league-invite-dialog.integration.test.tsx` (covers `navigator.clipboard` via boundary stub). File deleted.                                                                                                                                                                                                                                                                                                                   |
| `src/components/Leaderboard/Leaderboard.test.tsx`             | 168   | **Keep as unit**                           | Pure presentational: rows, sort, accessibility. Correct layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/components/Layout/Layout.test.tsx`                       | 198   | **Keep as unit**                           | Composition + slot rendering. Correct layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/components/AppSidebar/AppSidebar.test.tsx`               | 421   | **Keep as unit**                           | Router mocks are `useNavigate`/`Link` stubs only — matches the documented unit-layer pattern. Assertions are presentation given props (sidebar items, current-route highlighting, account menu). No journey-level assertions to migrate.                                                                                                                                                                                                                                                                                                                             |
| `src/components/AppContainer/AppContainer.test.tsx`           | 248   | **Keep as unit**                           | Composition shell. Correct layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/components/Team/Team.test.tsx`                           | 514   | **Done (Commit 5): extract `<TeamView />` + migrate** | `<TeamView />` extracted; `MyTeamRoute`/`TeamRoute` rewired to render it. UX enforcement (uniqueness filtering, budget-cap disable, lock-deadline disable, readOnly `/team/$teamId`, captain-error visibility) moved to new `team-lineup.integration.test.tsx`. `Team.test.tsx` kept (not deleted) and trimmed to TeamView's leaf assertions: owner-name in readOnly, subtitle, lock countdown formatting branches. |
| `src/components/CreateTeam/CreateTeam.test.tsx`               | 165   | **Migrate to integration + delete**        | Loader + form-submit + redirect wiring all live in `team-lineup.integration.test.tsx` (or a sibling `create-team.integration.test.tsx` if it gets crowded). No form extraction — CreateTeam is a single-purpose form with no reuse story; extracting `<CreateTeamForm />` purely to enable a unit test would be test-driven design. Delete the file. Sign-up → create-team golden path is owned by `team.spec.ts`.                                                                                                                                                   |
| `src/components/DriverPicker/DriverPicker.test.tsx`           | 400   | **Done (Commit 5): trimmed**               | All hook-state-driven cases removed (Picker Sheet contents, Error Handling, Budget Filtering, mocked-error read-only). Inert `vi.mock('@/hooks/useLineupPicker', …)` retained — picker calls `useRouter()` via the hook, so a no-op stub is the cheapest way to keep these props-in/DOM-out tests router-free. Plan called for full removal of the mock; reality kept it inert for that reason.                                                                                                                                                                       |
| `src/components/ConstructorPicker/ConstructorPicker.test.tsx` | 445   | **Done (Commit 5): trimmed**               | Same shape as DriverPicker. Constructor-uniqueness now lives in `team-lineup.integration.test.tsx` against real router + real picker.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/components/auth/SignInForm/SignInForm.test.tsx`          | 111   | **Keep as unit**                           | Form validation + submit. `auth.spec.ts` owns the full sign-in journey. No migration needed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/components/auth/SignUpForm/SignUpForm.test.tsx`          | 150   | **Keep as unit**                           | Same as SignInForm.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Out of scope by the issue's page-/route-level framing (i.e., not page or route components). Each was verified at the correct layer — by reading the file or by `grep` confirming no `vi.mock` of `@tanstack/react-router`, services, or `lib/api`:

- **Contexts** (provider against mocked dependency, narrow surface): `AuthContext.test.tsx`, `TeamContext.test.tsx`.
- **Hooks** (pure hook tests, no router mounting): `useAuth.test.tsx`, `useTeam.test.tsx`, `useLineupPicker.test.ts`, `useAvatarUpload.test.ts`, `useClipboard.test.ts`, `useLiveRegion.test.ts`.
- **Services** (against mocked `apiClient`): all of `driverService`, `constructorService`, `seasonService`, `raceWeekendService`, `leagueInviteService`, `userProfileService`, `teamService`, `leagueService`.
- **`lib/`** (pure unit / utility): `api.test.ts`, `utils.test.tsx`, `supabase.test.ts`, `avatarEvents.test.ts`.
- **Leaf / presentational components** (props-in-DOM-out, no router or service mocks except small surface stubs): `DriverCard`, `ConstructorCard`, `FormField`, `InlineError`, `InlineSuccess`, `LiveRegion`, `LoadingButton`, `DriverListItem`, `ConstructorListItem`, `AvatarUpload`, `ErrorBoundary`, `ErrorFallback`. The one router-mocking leaf is `LeagueList.test.tsx` (69 lines, stubs `useLoaderData`/`Link`/`useNavigate` only) — matches the existing `web/CLAUDE.md` "mock TanStack Router hooks" pattern for the unit layer.

Nothing in this set warrants migration. They're not modified by this issue.

## Implementation — sequenced commits

Each commit is self-contained: build + lint + format + `npm run web:test` (full suite, includes integration) all green, with no net coverage drop in failure modes covered.

### Commit 1 — `web/CLAUDE.md`: collapse three internal layers to two (docs only)

Rewrite the "Frontend Test Layering" section so the framing matches RTL/Kent's guiding principles and the integration layer that #134 introduced:

- **Drop the three-layer split.** Replace with two layers: leaf/presentational components + hooks. Container/parent components (`DriverPicker`, `ConstructorPicker`, page components) are not a separate jsdom-level layer — their behavior belongs in integration.
- **Drop the "mock TanStack Router hooks" code example** as a default pattern for route components. Mounting a route component with `vi.mock('@tanstack/react-router', ...)` decouples the test from the loader/guard wiring integration exists to verify. Replace with a one-liner pointing to the integration layer.
- **Add the heuristic:** "If the setup is longer than the assertions, the test is in the wrong layer."
- **Reframe the hooks layer** so direct hook tests are the exception (state machine, async branches, error rollback), not the default. Trivial passthrough hooks (`useAuth`, `useTeam`) are honestly covered by integration tests of their consumers.
- **Keep:** the unit-test-route-guards-as-functions pattern (still valid), the do-not-test list (static JSX, library internals, Zod-via-form), the delegation to root `CLAUDE.md` for cross-cutting layer choice.

No code changes. Sets the framing reviewers will read while reviewing the migration commits, and explains why Commits 5 and 9 trim more aggressively than the original audit suggested.

### Commit 2 — Delete redundant shell/landing tests

No new E2E case needed. The originally proposed landing-CTA E2E was reconsidered: the handler is a one-line `navigate({ to: '/sign-up' })` with no loader, guard, or async, and every other spec already exercises the same router/route via `page.goto('/sign-up')`. A CTA-click E2E would prove nothing those don't already prove, so adding it would be overhead disguised as coverage.

- Delete `web/src/main.test.tsx` (entire file — every assertion is mocked-stub-renders-mocked-stub; no journey or failure mode covered).
- Delete `web/src/components/LandingPage/LandingPage.test.tsx` (entire file — static-JSX assertions per the existing `web/CLAUDE.md` do-not-test list, plus a shallow CTA click that other specs cover via the route itself).

Verify no other test imports from these files (none expected — co-located).

### Commit 3 — Migrate leagues page-level tests → integration + add browse-join E2E (done: `56e9aa7`)

**Done (slightly broader than originally planned — see "What changed" below):**

- Appended to `e2e/tests/league.spec.ts`: "User B browses available leagues, joins User A's public league from the list" — list → join → detail, distinct from invite-URL join.
- Added `web/src/tests/integration/leagues.integration.test.tsx` (12 cases) covering `/browse-leagues` and `/league/$leagueId`: list renders, empty state, 500 → errorComponent, join failure branches, badges, member-count format, empty-description edge, private-disabled join button, dialog cancel, per-row dialog scoping, accessibility, league detail loader, 404, 500.
- Added `web/src/tests/integration/league-invite-dialog.integration.test.tsx` (5 cases) covering the invite dialog flow: lazy fetch, error message, cache-across-reopens (single network call), copy via stubbed `navigator.clipboard`, Escape close.
- Deleted `BrowseLeagues.test.tsx` and `League.test.tsx` entirely. Both were route components mocking `useLoaderData`/`useNavigate`/`useRouteContext`; per the new framing, route components belong in integration. All unique presentational assertions absorbed into the integration tests above.

**What changed vs. the original plan:**

- Plan said "trim `BrowseLeagues.test.tsx` to row/column presentational tests if any remain"; reality was "delete the file." The trimmed tests still required mocking the router on a route component — the same anti-pattern the new framing rejects. Migrating the assertions into integration was honest; keeping a "trimmed" file was not.
- Plan didn't mention `league-invite-dialog.integration.test.tsx`. Surfaced during execution: the invite-dialog flow (lazy fetch, cache, error, copy, keyboard) is real stateful behavior with no honest home at the unit layer (it lives inside a route component) and no E2E coverage beyond opening the dialog once. New integration file added.
- E2E gap closed as planned (browse-leagues join-from-list).

**Lesson applied to subsequent commits:** route components don't get "trimmed" component tests — they either get an extracted presentational sub-component (when reuse or composition justifies it independently of testing) or they get deleted, with assertions migrated to integration. See updates to Commits 4–6 and 8.

### Commit 4 — Migrate join-invite flow → integration; delete the unit test

Add `web/src/tests/integration/join-invite.integration.test.tsx` covering:

- `/join/$token` preview render (real loader hits MSW for invite preview).
- Auth-conditional CTA branches:
  - Unauth → "Sign up to join" + "Sign in" links present (assert href contains `?redirect=/join/$token`).
  - Auth-with-team → "Join League" button present.
  - Auth-without-team → "Create Team" link present (assert href contains `?redirect=/join/$token`).
- Error branches:
  - Invalid/expired token → loader 404 → notFound branch renders.
  - Full league → specific error response → "League full" alert visible, action buttons hidden.
  - Generic 500 on join click → InlineError surfaces, no navigation.

**Not covered (intentional): join-success-and-navigate.** `league.spec.ts:16` proves it end-to-end through a real backend; duplicating it at integration is the kind of overlap the trim-aggressively rule rejects.

**Delete `JoinInvite.test.tsx`** rather than trimming. JoinInvite is a route component reading from `useLoaderData` (preview) and `useAuth`/`useTeam` (auth-conditional CTAs). Every existing assertion needs router/context mocks to render — the same anti-pattern Commit 3 surfaced. Any presentational sub-piece worth keeping at the unit layer would need to be extracted into a real leaf component; there's no reuse pressure to justify that here, so migrate-and-delete is the honest call.

(Unauth signup → join end-to-end journey stays owned by `league.spec.ts:65`.)

### Commit 5 — Extract `<TeamView />` + migrate team-lineup UX enforcement → integration (done: `b788e17`)

**Done:**

- `<TeamView />` extracted in `Team.tsx`; `MyTeamRoute` and `TeamRoute` rewired as thin orchestrators.
- `web/src/tests/integration/team-lineup.integration.test.tsx` added with six cases: constructor-pool filtering, driver-pool filtering, budget-cap disables over-budget drivers in the picker, lock-deadline disables pickers + shows "Lineup Locked", `setCaptain` failure surfaces an error message, `/team/$teamId` renders readOnly without action buttons.
- `Team.test.tsx` reduced to TeamView leaf assertions: owner name in readOnly, subtitle, lock countdown formatting (5 cases). Sentry/`setCaptain`/`userEvent` imports and mocks dropped; picker children stubbed to `() => null` purely as render noise reduction (no test reads from them).
- `DriverPicker.test.tsx` and `ConstructorPicker.test.tsx` trimmed per plan.

**What changed vs. the original plan:**

- **Constructor/driver uniqueness cases ship as one-direction filter tests**, not the round-trip swap the plan specified ("place constructor B in slot 1, re-open slot 0's picker, assert B is now unavailable"). The single-direction assertion exercises the parent↔picker wiring path — same failure mode the prod-bug case would catch. The round-trip second half didn't add a distinct failure mode worth the extra setup.
- **Budget-cap case asserts preventive disabling**, not post-hoc submit-blocked + InlineError. Plan said "attempt to add a driver whose price pushes total over the cap, assert the InlineError content"; reality is the picker disables over-budget drivers up front, so the user can't trigger the failure path the plan imagined. Asserting the disabled state at the point of choice is honest; asserting an error that doesn't render isn't.
- **Captain-error-visibility case added** that wasn't in the original Commit 5 list. Surfaced during review of the trimmed `Team.test.tsx`: the original unit test bundled "error renders" with "error positioned above picker." `team.spec.ts` only covers the captain success path, and no other test covers the failure path UI. Position assertion was judged not load-bearing and dropped; the visibility assertion (failed `setCaptain` → `role="alert"` appears) moved to integration.
- **`Team.test.tsx` was kept and trimmed, not deleted into a new `TeamView.test.tsx`**. Same effective coverage, lighter rename. The plan-mandated "no router mocks" criterion is met (the file no longer imports from `@tanstack/react-router`).
- **The `vi.mock('@/hooks/useLineupPicker', …)` block in the picker tests was retained as inert**, not removed. The picker calls `useRouter()` via the hook, so an inert mock is the cheapest way to keep the remaining props-in/DOM-out tests router-free. Plan was idealistic on this point.

---

This commit does two things in lockstep (per the project's "functionality + tests in the same commit" rule):

1. **Extract `<TeamView team races readOnly onAdd onRemove onCaptain />`** as a presentational view, and rewire `MyTeamRoute` and `TeamRoute` to render it. This isn't test-driven design — both routes already render the same underlying view today, so the extraction has independent reuse value. The route components become thin orchestrators that pull loader data and pass it down; `<TeamView />` becomes a props-in/DOM-out surface that's honestly unit-testable.
2. **Add `web/src/tests/integration/team-lineup.integration.test.tsx`** to cover the UX-enforcement assertions that need the real router + real pickers + real mutations against MSW. This is the canonical integration test the #134 context calls out — the constructor-uniqueness drift bug is the reason the layer exists.

**Route-tree scaffolding note.** `/my-team` lives under the `_authenticated → _team-required` chain (`router.tsx:284, 394, …`) with `requireAuth` + `requireTeam` guards plus a loader chain that fetches profile, team, and current season/race weekend. The integration test should mirror this minimally: include the same guards and only the loaders the component actually consumes, and supply MSW handlers for each (`/me/profile`, `/me/team`, `/seasons/current`, plus `/me/team/drivers`, `/me/team/constructors`, `/me/team/captain` for mutations under test). Use `createMockTeam`, `createMockDriver`, `createMockConstructor` from `@/test-utils` for response bodies. Pass authed `auth` to `renderWithRouter`.

Cases (each one explicitly-named `it(...)`):

- **`prevents picking the same constructor in both slots`** — the prod-bug case. Mount `/my-team` with a team that already has constructor A in slot 0 and slot 1 empty. Open ConstructorPicker for slot 1. Assert constructor A is absent from the selectable pool (or rendered disabled, per actual UI). Then place constructor B in slot 1, re-open slot 0's picker, assert B is now unavailable. This stateful round-trip is what the existing unit assertion (`ConstructorPicker.test.tsx:156`) does not cover — that test passes a static prop; this one exercises parent ↔ picker wiring, which is where the drift slipped in.
- **`prevents picking the same driver across slots`** — DriverPicker analogue.
- **`blocks submit when total spend exceeds budget cap, surfaces inline error`** — attempt to add a driver whose price pushes total over the cap, assert the `InlineError` content + that no POST/PUT to `/me/team/drivers` fires (use MSW handler that fails the test if called, or assert with a spy/counter).
- **`disables pickers and shows "Lineup Locked" when lockDeadline is in the past`** — MSW returns a `lockDeadline` in the past for the current race weekend. Cross-check: `team.spec.ts:105` covers this end-to-end. Keep both — the integration version verifies the UI rule against stubbed data and runs in milliseconds; the E2E version verifies the deployed config path.
- **`renders /team/$teamId in readOnly mode without action buttons`** — visit `/team/$teamId` (the route at `router.tsx:556`) for another user's team. MSW returns a populated roster. Assert: roster visible, owner name visible, no "Remove driver" / "Add Driver" / "Set captain" buttons. This route currently has no integration or E2E coverage above unit-level prop-passing — added per the audit.

Then trim:

- `Team.test.tsx`: **delete the file**. Team is a route component reading `useLoaderData`; the entire test file mocks router hooks + pickers + setCaptain. The presentation-given-props assertions worth keeping (countdown formatting, captain-error placement, owner-name in readOnly mode) move to a new `web/src/components/Team/TeamView.test.tsx` against the extracted `<TeamView />` component — those become honest leaf-component tests with no router mocks.
- `DriverPicker.test.tsx` and `ConstructorPicker.test.tsx`: full trim — every test that depends on a forced `useLineupPicker` return value goes. Specifically delete:
  - **Picker Sheet** describe: `displays all available drivers/constructors from pool`, `only displays drivers/constructors not in current lineup` (the line-156 prod-bug case — now in integration), `keeps sheet open when operation is pending`.
  - **Error Handling** describe: all three (`displays error message above grid`, `displays error regardless of picker state`, `does not display error when no error exists`). The error originates from a real failed mutation in production; integration with MSW returning 500 is the honest test.
  - **Accessibility** describe: `uses semantic HTML with proper roles` (only fires because `selectedPosition` is mocked open).
  - **Read-Only Mode** describe: `displays errors in read-only mode` (mocked-error issue).
  - **Budget Filtering** describe: both tests (covered by Commit 5's `blocks submit when total spend exceeds budget cap` integration case).
  - The `vi.mock('@/hooks/useLineupPicker', ...)` block at the top of each file, plus the `mockPool` / `mockSelectedPosition` / `mockIsPending` / `mockError` `let` declarations and the `beforeEach` setup that fed them.
- After the trim, what remains is props-and-callbacks-driven only:
  - `DriverPicker`: Lineup Rendering (3), Picker Sheet `does not display sheet when picker is closed`, Accessibility `provides descriptive button labels` + `provides aria-label for remove buttons`, Read-Only Mode (3 — readOnly short-circuit, displays lineup, picker-closed), Captain (3). ≈12 tests.
  - `ConstructorPicker`: same shape, plus Section Header (2). ≈14 tests.
- The "keeps sheet open when pending" assertion is hook behavior, not picker behavior. If `useLineupPicker.test.ts` doesn't already cover it, add it there.

### Commit 6 — Migrate create-team flow → integration; delete the unit test

Extend `team-lineup.integration.test.tsx` (or split out `create-team.integration.test.tsx` if file gets >250 lines) with:

- `/create-team` loader renders the form (real `requireNoTeam` guard + MSW for `/me/team` returning null).
- Submit success → navigates to `/my-team`.
- Submit failure surfaces `InlineError`.
- Form validation rules (e.g., empty team name → field error, no submit fires) — covered through the real form against MSW so Zod + RHF + submit handler are exercised together.

**Delete `CreateTeam.test.tsx`.** No `<CreateTeamForm />` extraction. CreateTeam is a single-purpose form with no reuse story — no second consumer, no composition pressure (the route is just the form), no Storybook entry point. Extracting it solely to enable a unit-layer test would be the test-driven design smell. Validation and dirty-tracking branches are exercised honestly through the integration test against the real Zod schema + RHF.

(Sign-up → create-team end-to-end journey stays owned by `team.spec.ts`.)

### Commit 7 — Add route-guard wiring integration tests

Not a migration — a coverage gap surfaced during the audit. `web/CLAUDE.md` says the integration layer "covers guard wiring by mounting layouts with the real guard attached," but no test does this today. `route-guards.test.ts` exercises guards as plain functions; only E2E (`auth.spec.ts:30`) proves the real-router-with-guard wiring.

Add `web/src/tests/integration/route-guards.integration.test.tsx` covering three redirect cases via `renderWithRouter` against minimal route trees that mirror the production guard placement in `router.tsx`:

- Unauth → `/my-team` → redirect to `/`.
- Auth without team → `/my-team` → redirect to `/create-team` (`requireTeam` placement).
- Auth with team → `/create-team` → redirect to `/my-team` (`requireNoTeam` placement).

Each test stubs only the network handlers the guard's loader needs (e.g., `getMyTeam` returns null vs. a team object). Real guards run, real router runs, real `AuthContext` is wired through `renderWithRouter`'s `auth` argument. No new production code; no changes to `router.tsx` or `route-guards.ts`.

This is the canonical "wiring test that catches drift between layout-route placement and guard semantics" — same class of bug as the constructor-uniqueness case that motivated #134.

### Commit 8 — Extract `<AccountForm />` + delete Account.test.tsx

Same shape as Commit 5: extraction + test reorganization in lockstep, justified by independent design value (not test-driven).

1. **Extract `<AccountForm profile onSubmit />`** as a presentational form component. Account.tsx already composes AvatarUpload + form fields + display block — that's three surfaces in one file, so pulling the form out matches existing composition pressure. The route component becomes a thin orchestrator (loader → AvatarUpload + AccountForm); `<AccountForm />` becomes a props-in/callback-out leaf that's honestly unit-testable.
2. **Add `web/src/components/Account/AccountForm.test.tsx`** covering form mechanics at the unit layer (no router mocks, no service mocks):
   - Pristine state: no submit when nothing changed.
   - Field-level validation rules (display name required, etc.) via the real Zod schema + RHF.
   - Submit invokes `onSubmit` callback with the dirty values.
   - Accessibility assertions specific to form layout (label associations, error announcement).
3. **Delete `Account.test.tsx`**. Loader/500/network-round-trip coverage already lives in `account.integration.test.tsx`. Avatar prop-passing belongs in `AvatarUpload.test.tsx` (likely already covered) — verify before deleting.

### Commit 9 — Trim hook tests where integration covers the consumer

Sequenced last because it depends on Commits 4–7's integration tests already exercising the hook consumers in production-shaped wiring.

For each hook test, ask: "If I delete this, does any failure mode go uncovered?"

- **Delete or substantially trim** `web/src/hooks/useAuth.test.tsx` and `web/src/hooks/useTeam.test.tsx`. These are mostly "context returns context" passthroughs. Their consumers run end-to-end in `account.integration.test.tsx` (Commit 0/baseline), `route-guards.integration.test.tsx` (Commit 7), and the team-lineup integration tests (Commit 5). Before deleting, read each `it()` and confirm the failure mode it covers is touched by a consumer-level integration assertion; if anything is uniquely held by the hook test, copy that assertion into the most natural integration test before deleting.
- **Keep direct** `useLineupPicker.test.ts`: state machine for picker open/close, optimistic mutation, error rollback, pool filtering. Branch coverage at this layer is honest.
- **Keep direct** `useAvatarUpload.test.ts`: async upload validation + error states, branchy enough that a consumer-based test would be more setup than assertion.
- **Keep direct** `useLiveRegion.test.ts`: DOM-ref + announcement timing, awkward to test through a consumer.
- **Judgment call** `useClipboard.test.ts`: trivial wrapper around `navigator.clipboard.writeText`. Keep if the file is small (~30 lines); delete if it's just asserting the wrapper calls the API.

No new tests added. This commit is purely a deletion + a per-hook coverage check. Verification step 5 ("manually re-read migrated assertions") becomes "manually re-read deleted assertions and grep the integration suite for the same failure modes."

## Critical files

- `web/CLAUDE.md` — two-layer rewrite (commit 1).
- `web/src/tests/integration/account.integration.test.tsx` — pattern to clone for every new integration test (real `createRootRouteWithContext`, real guards, `renderWithRouter`, MSW per-test handlers).
- `web/src/test-utils/renderWithRouter.tsx` + `web/src/test-utils/mockFactories.ts` — reuse `renderWithRouter`, `createMockUserProfile`, `createMockTeam`, `createMockDriver`, etc. Add new factories (e.g., `createMockLeague`, `createMockLeagueInvite`) only if a flow needs one and nothing exists; follow the established `Partial<T>`-overrides pattern.
- `web/src/setupTests.ts` — exports `server` (MSW) and `API_BASE`. Build URLs from `API_BASE`; never hardcode.
- `e2e/tests/{auth,avatar,league,team}.spec.ts` — read-only reference for what's already journey-tested in a real browser; nothing migrates _into_ these files unless a gap surfaces during a commit (Commits 2 and 3 each append one small case).
- All test files listed in the audit table — modified per the action column.

Reuse rules (no new abstractions):

- Don't introduce per-service path constants in MSW handlers (per `web/CLAUDE.md` integration section).
- Don't extract a shared `handlers.ts` until 3+ flow tests share the same handler (per the trigger documented in `web/CLAUDE.md`).
- Don't `vi.mock('@tanstack/react-router', ...)` or service modules in any new integration test.

## Verification

Per commit, before marking the commit done:

1. `npm run web:test` — full suite green (unit + integration).
2. `npm run web:lint` and `npm run web:format:check` — clean.
3. `npm run web:build` — type check passes.
4. `npm run web:coverage` — failure-mode coverage preserved. (Coverage % may drop because deleted jsdom tests weren't catching unique failure modes; the integration test that replaces them is what's load-bearing. Confirm by reading the coverage diff: any line/branch newly uncovered should map to a "test the wrong thing was testing" — never to a real failure mode.)
5. Manually re-read the migrated assertions to confirm the new integration test asserts on at least the failure modes the deleted assertions covered (the "no net loss of coverage" criterion).

End-to-end (after all commits land):

6. `npm run test:all` green.
7. `npm run e2e` green (the two appended specs in commits 2 and 3 should pass; existing specs unchanged).
8. Read final `web/CLAUDE.md` — the two-layer rewrite is concrete enough that a future contributor can pick the right layer without asking.
