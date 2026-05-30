# Issue #207 — No-team empty state on the Home page

## Context

The authed `/` route renders `Home`, a pure presentational leaf. PR #206 left a placeholder for the no-team case: when `team === null`, `Home` currently shows only a "Welcome, {name}" heading, still renders the two score cards (as em-dashes), and renders the leagues list inline gated on `standings.length > 0`. That placeholder reads as a half-broken full state rather than a deliberate onboarding surface.

This issue replaces that placeholder with the real no-team experience: a `CreateTeamHero` call-to-action, no score cards, and a `LeaguesNeedTeamNotice` empty card in place of the leagues list. Along the way it extracts the inline leagues list into `MyLeaguesList` (so the leagues area reads as a clean two-branch conditional) and renames the route dispatcher `HomeRoute → IndexRoute` (it dispatches anon→`LandingPage` / authed→`Home`; it is not a Home surface).

`Home` stays a **single** presentational component that conditionally renders child components on `team` — this is a deliberate reversal of the design handoff's three-component framing (see the as-built note in `docs/mockups/home-page/design-handoff.md`). Copy and the unified `NextRaceCard` (no compact variant) follow **this issue**, not the handoff.

## Approach

Three self-contained commits, each independently passing build/lint/test/format, each a gate (wait for approval before the next):

1. Rename `HomeRoute → IndexRoute` (isolated, no behavior change).
2. Extract `MyLeaguesList` from `Home.tsx` (pure refactor, no behavior change).
3. Add the no-team state: `CreateTeamHero` + `LeaguesNeedTeamNotice`, gate score cards on `team`, rewire the leagues conditional, update tests.

---

## Commit 1 — Rename `HomeRoute` → `IndexRoute`

Move `web/src/components/Home/HomeRoute.tsx` → `web/src/components/IndexRoute/IndexRoute.tsx`; rename `export function HomeRoute()` → `export function IndexRoute()`. Body is unchanged (still `useLoaderData({from:'/'})` + `useRouteContext({from:'__root__'})`, branch to `LandingPage` when `home===null || profile===null`, else map props into `Home`).

Update the 4 references:
- `web/src/router.tsx:5` — import path → `@/components/IndexRoute/IndexRoute`; `:208` — `component: IndexRoute`. (Import stays in its sorted slot; no import-order churn.)
- `web/src/tests/integration/root-routing.integration.test.tsx:1` — import path; `:56` — `component: IndexRoute`. (The test's tree-builder helper is **already** named `buildIndexRouteTree`, so only these two edits are needed here.)

No behavior change; existing integration tests stay green.

**Gate:** `npm run web:build`, `web:lint`, `web:test`, `web:format:check` all pass.

---

## Commit 2 — Extract `MyLeaguesList` (pure refactor)

New `web/src/components/Home/MyLeaguesList.tsx` (named export, matching the `NextRaceCard.tsx` file-per-component pattern):
- Prop: `standings: MyLeagueStanding[]`.
- Contains the current leagues block (`Home.tsx` lines 61–114): the "My Leagues" heading + "View all →" link, the aria-hidden mobile/desktop header rows, and the `<ul role="list" aria-label="My Leagues">` of row links.
- Owns the `Link` and `cn` imports, the `rowBase/rowChrome/rowHover/rowFocus` consts, and a local `const EM_DASH = '—'` (used for `entry.position ?? EM_DASH`).
- Returns `null` when `standings.length === 0` (preserves #206's "render nothing when empty" behavior).

In `Home.tsx`:
- Replace the `{standings.length > 0 && (…)}` block with `<MyLeaguesList standings={standings} />` (rendered unconditionally — the internal guard preserves behavior).
- Remove the now-unused `Link` and `cn` imports (`no-unused-vars` is `error`, so this is enforced).
- Keep `Home`'s own `EM_DASH` (still used by the score cards + inline `ScoreCard`).

Tests (relocate list logic to the lowest layer that can see it):
- New `web/src/components/Home/MyLeaguesList.test.tsx` (colocated, per the file-per-component convention) covering its branch logic: a row renders as a link with the correct `href` (`/league/12`) and league name; the position renders; **`position: null` → em-dash** (a real branch — `MyLeagueStanding.position` is `number | null` — currently untested); empty `standings` → renders nothing.
- `Home.test.tsx`: the existing "renders the leagues section with a row link and the position" test asserts row internals now owned by `MyLeaguesList.test.tsx` — **slim it** (don't duplicate) to a composition check that the "My Leagues" list branch appears when `standings` is present. The "does not render when empty" test stays as a composition check (default `team: null`, empty → no list).

Both still green in Commit 2 (Home renders `MyLeaguesList` unconditionally; default `team: null`).

> Note for #208: when the "team but no leagues" empty state lands, Home's team-present branch will gate on `standings.length` and `MyLeaguesList`'s internal `length===0 → null` guard becomes redundant — a one-line follow-up, not rework.

**Gate:** build/lint/test/format all pass; `web/src/components/Home/` diff is move-only (no behavior change).

---

## Commit 3 — Add the no-team state

### New `web/src/components/Home/CreateTeamHero.tsx`
Solid-border card matching `NextRaceCard` chrome and two-column layout:
- Card: `bg-card rounded-[0.65rem] border p-4 md:p-6`.
- Inner: `flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6` (stacked mobile, two-col at `md:`).
- Left: `<h2>` headline **Get on the grid** (card-title treatment like `NextRaceCard`'s race name: `text-foreground text-xl font-bold tracking-tight md:text-2xl`); body `<p>` (`text-muted-foreground mt-1 text-sm`): **Pick 5 drivers and 2 constructors with a $100M budget. Set a captain to earn 2× points on their race score.**
- Right: `<Button asChild size="lg" className="w-full md:w-auto"><Link to="/create-team">Create team</Link></Button>` (full-width on mobile, auto at `md:`, no icon). Idiom confirmed in `JoinInvite.tsx`; `/create-team` exists and its `redirect` search param is optional, so `Link to="/create-team"` type-checks with no `search` prop.

### New `web/src/components/Home/LeaguesNeedTeamNotice.tsx`
Dashed-border empty card using the vendored `ui/empty.tsx` primitive:
```
<Empty className="border">
  <EmptyHeader>
    <EmptyMedia variant="icon"><Users /></EmptyMedia>
    <EmptyTitle>Leagues unlock with a team</EmptyTitle>
    <EmptyDescription>You'll be able to join private leagues with friends or browse public ones.</EmptyDescription>
  </EmptyHeader>
</Empty>
```
- `className="border"` supplies the border **width**; the primitive already sets `border-dashed` **style** (`tailwind-merge` keeps both — different groups). Do **not** modify `empty.tsx` (vendored).
- `<Users />` left unsized so `EmptyMedia variant="icon"` sizes it to `size-6` via its `[&_svg:not([class*='size-'])]:size-6` rule.
- Raw apostrophe in "You'll" is fine (repo precedent: `JoinInvite.tsx:158`).
- No CTA (the create-team action is `CreateTeamHero`).

### `web/src/components/Home/Home.tsx`
- Add above `<NextRaceCard />`: `{team === null && <CreateTeamHero />}`.
- Gate the score-cards row: wrap the existing `<div className="grid …">…</div>` in `{team && ( … )}`.
- Replace `<MyLeaguesList standings={standings} />` with `{team === null ? <LeaguesNeedTeamNotice /> : <MyLeaguesList standings={standings} />}`.
- Identity header is unchanged (already collapses to "Welcome, {name}"). `ScoreCard` stays inline.

### Tests
`web/src/components/Home/Home.test.tsx` — cover the `team` conditional in **both directions** at this (lowest) layer:
- Add `team: createMockTeam(...)` to the two score-card tests and the slimmed leagues-composition test so they exercise the full state — they currently lean on the default `team: null` and would otherwise stop rendering the gated content (the "em-dashes when summary null" test especially must pass a `team`, or no score cards render). In the full-state tests, also assert the no-team children are **absent**: no `link` named "Create team" and no "Leagues unlock with a team" notice.
- Repurpose the empty-standings test to the full state: `team` present + empty `standings` → neither the "My Leagues" list nor the notice renders (the transitional #206 behavior that #208 will replace).
- Add a **no-team** test (default `team: null`): `getByRole('link', { name: /create team/i })` has `href="/create-team"`; the notice title "Leagues unlock with a team" is present; score cards are absent (e.g. `queryByText('Season stats')` is null); the "My Leagues" list/heading is absent. `CreateTeamHero` and `LeaguesNeedTeamNotice` are covered through this test — no separate files (zero-logic static-JSX leaves). Assert on text, not a `paragraph` role (`EmptyDescription` renders a `<div>`).

`web/src/tests/integration/root-routing.integration.test.tsx` — keep to the **single happy-path assertion** for the no-team route (don't re-walk the unit matrix here):
- In the existing "authed-no-team" test, in addition to the `Welcome, Ada` heading, assert `await screen.findByRole('link', { name: /create team/i })`. This one assertion proves the route→loader→`IndexRoute`→`Home` no-team branch wired end-to-end. The MSW handlers (404 summary / `[]` standings / `[]` races) and `team: null` context already match — no handler changes.

**Gate:** build/lint/test/format all pass; acceptance criteria below verified.

---

## Key implementation notes

- **Run `npm run web:format` before each commit.** `prettier-plugin-tailwindcss` auto-sorts `className` strings; committing unsorted classes fails `web:format:check` in CI. (`className="border"` is a single class, unaffected.)
- **`no-unused-vars` is `error`** — dropping `Link`/`cn` from `Home.tsx` in Commit 2 is enforced by lint.
- **`src/components/ui` is eslint-ignored and vendored** — never edit `empty.tsx`/`button.tsx`; compose around them.
- Heading hierarchy: keep the hero headline an `<h2>` (consistent with `NextRaceCard`'s card title); avoid `<h1>` (owned by `LandingPage`).

## Testing strategy alignment

- **Branch logic at the lowest layer.** List-rendering logic (rows, `position ?? EM_DASH`, empty→null) lives in `MyLeaguesList.test.tsx`; the `team` conditional lives in `Home.test.tsx`; neither re-walks the other's matrix.
- **Leaves with no logic aren't given their own files.** `CreateTeamHero` / `LeaguesNeedTeamNotice` are static-JSX + one link — covered once through `Home.test.tsx`'s no-team render (static JSX is on the do-not-test list).
- **One happy path higher up.** The integration test gets a single assertion (the no-team route renders the Create-team link), proving the route/loader wiring; it does not re-assert the child matrix.
- **No new E2E.** The no-team view is a presentational branch over the same loader data — no new cross-system wiring, auth, or contract. Adding E2E here would be ice-cream-cone. The create-team *flow* (click-through) is a separate concern with its own coverage. The typed `Link to="/create-team"` is a build-time guarantee the route exists.
- **Mocking `Link` in `Home.test.tsx`** is acceptable — it's a third-party routing primitive (not a child the component owns), matches the file's existing pattern, and the real `Link` is exercised by the integration layer.

## Verification

- `npm run test:all` (frontend + backend unit/integration) — green; specifically the updated `Home.test.tsx` and `root-routing.integration.test.tsx`.
- `npm run web:lint`, `npm run web:format:check`, `npm run web:build` — clean.
- Manual (not automatable per repo conventions — no CSS/breakpoint testing): run `npm run web:dev`, sign in as a user with no team, visit `/`, and confirm:
  - `CreateTeamHero` renders above the next-race card; **Create team** navigates to `/create-team`; hero is two-column at `md:` and stacks on mobile with a full-width button.
  - No score cards (no em-dash placeholders).
  - `LeaguesNeedTeamNotice` (dashed border + `Users` icon + title + paragraph) replaces the leagues list.
  - Identity header reads "Welcome, {firstName}".
  - A user **with** a team still sees the full state (team name, score cards, leagues list), and an anonymous visitor still sees `LandingPage`.

## Acceptance criteria (from the issue)

- [ ] `CreateTeamHero` renders above the next-race card with headline/body/`Create team`→`/create-team`.
- [ ] `LeaguesNeedTeamNotice` renders in place of the leagues list (`Users` icon, title, paragraph).
- [ ] Score-cards row does not render for the no-team user.
- [ ] Identity header reads "Welcome, {firstName}" (no regression from #206).
- [ ] After `HomeRoute → IndexRoute`, `/` still resolves to `LandingPage` (anon) and full `Home` (authed-with-team).
- [ ] `Home.test.tsx` no-team render + `root-routing.integration.test.tsx` authed-no-team assertions ship with the change.
