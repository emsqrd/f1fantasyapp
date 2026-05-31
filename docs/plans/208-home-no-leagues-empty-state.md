# Issue #208 — No-leagues empty state on the Home page

## Context

The authed `/` route renders `Home`, a single presentational component. #207 established its
leagues area as a two-branch conditional: `MyLeaguesList` when the user has leagues,
`LeaguesNeedTeamNotice` when they have no team. The middle case — a user **with a team but in no
leagues** — currently renders nothing (the team-present branch renders `MyLeaguesList`, which
returns `null` on empty standings), leaving the leagues area blank.

This issue fills that gap with `JoinLeaguesPrompt`, an empty-state card shown when `team` is
present and `standings.length === 0`. It completes the leagues area's three states:
`MyLeaguesList` (has leagues), `JoinLeaguesPrompt` (team, no leagues — this issue), and
`LeaguesNeedTeamNotice` (no team — #207).

`Home` stays a **single** presentational component that conditionally renders child components —
per the as-built note in `docs/mockups/home-page/design-handoff.md` (no route-level branching, no
separate `HomeNoLeagues` component). No preliminary refactors are needed: `MyLeaguesList` and the
`IndexRoute` split already landed in #207.

## Copy & icons (settled with the user — diverges from the issue's copy table)

The issue's copy table specified "You're flying solo" / "Create a league". The final copy was
worked out with the user and **intentionally differs** — build exactly this:

| Element                  | Final                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Heading                  | **You're riding solo**                                                                                                                     |
| Supporting copy          | **You've got the team — now you need a grid. Start a league with people you know or look for a public league with people you don't.**       |
| Media icon (large, top)  | **`Gauge`**                                                                                                                                |
| CTA 1                    | **My Leagues** — outline button, **`Users`** icon, → `/leagues`                                                                            |
| CTA 2                    | **Browse public** — primary button, **`Search`** icon, → `/browse-leagues`                                                                 |

- **CTA destinations.** `/browse-leagues` is a real route. "Create a league" has no standalone
  route — the `CreateLeague` dialog is mounted only on `/leagues` (its trigger pinned at the top
  of that page), so CTA 1 navigates there. The label is **"My Leagues"** — the app's own name for
  that page (sidebar item + route `pageTitle` + list heading) — chosen over "Create a league"
  (implies inline creation) and "Go to My Leagues" (wordy).
- **Icons mirror the sidebar.** `AppSidebar.tsx` uses `Users` for its "My Leagues" nav item and
  `Search` for "Browse Leagues"; the CTAs reuse those exactly. The large media icon is **`Gauge`**
  (a racing cue), kept distinct from the CTA `Users` and from the no-team card's `Users` media
  icon.

## Approach

Two self-contained code commits follow this docs commit, each independently passing
build/lint/test/format, each a gate (wait for approval before the next):

1. Add the no-leagues state: `JoinLeaguesPrompt` + rewire the leagues conditional in `Home`, with
   unit coverage.
2. Cover the no-leagues Home state at the routing (integration) layer.

---

## Commit 1 — Add the no-leagues state (`feat(web)`)

### New `web/src/components/Home/JoinLeaguesPrompt.tsx`

Static, prop-less presentational component (its own file, matching the `NextRaceCard.tsx` /
`LeaguesNeedTeamNotice.tsx` file-per-component pattern), composed from the vendored `ui/empty.tsx`
primitive:

```tsx
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Link } from '@tanstack/react-router';
import { Gauge, Search, Users } from 'lucide-react';

export function JoinLeaguesPrompt() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Gauge />
        </EmptyMedia>
        <EmptyTitle>You're riding solo</EmptyTitle>
        <EmptyDescription>
          You've got the team — now you need a grid. Start a league with people you know or look
          for a public league with people you don't.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-col gap-3 md:flex-row md:justify-center">
        <Button asChild variant="outline" className="w-full md:w-auto">
          <Link to="/leagues">
            <Users />
            My Leagues
          </Link>
        </Button>
        <Button asChild className="w-full md:w-auto">
          <Link to="/browse-leagues">
            <Search />
            Browse public
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
```

- **Dashed border:** `className="border"` supplies the border **width**; `ui/empty.tsx`'s base
  already sets `border-dashed` **style** (`tailwind-merge` keeps both — different groups) → a 1px
  dashed card, identical chrome to `LeaguesNeedTeamNotice`. Do **not** modify `empty.tsx`
  (vendored).
- **Icons** need no sizing/margin — `Button`'s base styles size SVGs to `size-4` and add `gap-2`.
  The large `<Gauge />` is left unsized so `EmptyMedia variant="icon"` sizes it to `size-6`.
- **CTAs** are plain `<Link>`s wrapped by `Button asChild`, so the component stays presentational
  (no `useNavigate`/state). Each button's text is its accessible name (icons decorative).
- **Layout:** CTAs stack full-width on mobile, side-by-side at `md:` (`EmptyContent` overridden to
  `flex-col gap-3 md:flex-row md:justify-center`; buttons `w-full md:w-auto`). Exact responsive
  classes are a manual visual check (no breakpoint testing per repo conventions).
- Raw apostrophes in "You're" / "don't" are fine (repo precedent: `LeaguesNeedTeamNotice.tsx`,
  `JoinInvite.tsx`).

### `web/src/components/Home/Home.tsx`

Import `JoinLeaguesPrompt` and replace the two-way leagues-area conditional with a three-way:

```tsx
{!team ? (
  <LeaguesNeedTeamNotice />
) : standings.length === 0 ? (
  <JoinLeaguesPrompt />
) : (
  <MyLeaguesList standings={standings} />
)}
```

### `web/src/components/Home/MyLeaguesList.tsx` — no change

Its `if (standings.length === 0) return null` guard is now unreachable from `Home` (which only
renders it with non-empty standings) but stays as a harmless standalone contract, kept covered by
its existing `renders nothing when standings are empty` test. Removing it would churn a passing
test for no benefit (the #207 plan flagged this as an optional one-line follow-up; YAGNI — leave
it).

### Tests — `web/src/components/Home/Home.test.tsx`

`@tanstack/react-router`'s `Link` is already mocked here to a plain `<a href>`, so href assertions
work directly.

- Replace the now-incorrect `leagues list` test "renders neither the leagues list nor the notice
  for a team with no standings" — that case now renders `JoinLeaguesPrompt`. Add a
  `no-leagues state` describe block (mirroring `no-team state`) asserting, for
  `renderHome({ team: createMockTeam(), standings: [] })`:
  - `You're riding solo` text present (assert on **text** — `EmptyTitle` renders a `<div>`, not a
    heading).
  - link named `My Leagues` → `href="/leagues"`; link named `Browse public` →
    `href="/browse-leagues"`.
  - `My Leagues` _heading_ and _list_ roles absent; `Leagues unlock with a team` absent.
- In "renders the My Leagues list when standings are present", add
  `expect(screen.queryByText("You're riding solo")).not.toBeInTheDocument()` (acceptance: prompt
  hidden when standings present).
- The `score cards` / `identity header` tests default `standings: []`, so they now also mount
  `JoinLeaguesPrompt`; its copy doesn't collide with their assertions, so they stay green — no
  change needed.

`JoinLeaguesPrompt` is a static-JSX leaf (no logic) — covered through `Home.test.tsx`, no separate
file (static JSX is on the do-not-test list), matching how #207 covered `LeaguesNeedTeamNotice`.

**Gate:** `npm run web:build`, `web:lint`, `web:test`, `web:format:check` all pass.

---

## Commit 2 — Cover the no-leagues state at the routing layer (`test(web)`)

`web/src/tests/integration/root-routing.integration.test.tsx` — one happy-path assertion (don't
re-walk the unit matrix). Add an `it(...)` mirroring the existing no-team case but authed **with**
a team and **empty** standings:

- `server.use`: `/me/team/summary` → `{ seasonTotalPoints: null, lastRace: null }`;
  `/me/standings` → `[]`; `/seasons/${CURRENT_SEASON.id}/race-weekends` → `[]`.
- `teamContext = createTeamContext({ myTeamId: 1, hasTeam: true })`; router context with
  `team: createMockTeam(...)`, a `profile`, and `currentSeason: CURRENT_SEASON`.
- Assert `await screen.findByText("You're riding solo")`. This proves the
  route→loader→`IndexRoute`→`Home` team-present/no-leagues branch wired end-to-end.
- The real router renders `<Link to="/leagues">` / `<Link to="/browse-leagues">` fine in this
  harness — the existing authed-with-standings test already renders `<Link to="/leagues">` (via
  `MyLeaguesList`) against the same single-route test tree.

**Gate:** build/lint/test/format all pass.

---

## Key implementation notes

- **Run `npm run web:format` before each commit.** `prettier-plugin-tailwindcss` auto-sorts
  `className` strings; unsorted classes fail `web:format:check` in CI.
- **`src/components/ui` is vendored / eslint-ignored** — never edit `empty.tsx` or `button.tsx`;
  compose around them.
- **`no-unused-vars` is `error`** — keep imports tight.
- New lucide imports in `JoinLeaguesPrompt`: `Gauge`, `Search`, `Users`. No `Plus` (the issue's
  icon) — see the Copy & icons table.

## Testing strategy alignment

- **Branch logic at the lowest layer.** The three-way `team` / `standings` conditional is
  exercised in `Home.test.tsx` (no-team, no-leagues, has-leagues). `MyLeaguesList`'s own row/empty
  logic stays in `MyLeaguesList.test.tsx` — not re-walked.
- **One happy path higher up.** The integration test gets a single assertion (the no-leagues route
  renders the prompt), proving route/loader wiring; it does not re-assert the child matrix.
- **Leaf with no logic gets no own file.** `JoinLeaguesPrompt` is static JSX + two links — covered
  once through `Home.test.tsx`.
- **No new E2E.** A presentational branch over the same loader data — no new cross-system wiring,
  auth, or contract. Typed `Link to`s are build-time guarantees the routes exist.

## Verification

- `npm run web:test` (unit + integration) — green; specifically the updated `Home.test.tsx` and
  `root-routing.integration.test.tsx`.
- `npm run web:lint`, `npm run web:format:check`, `npm run web:build` — clean.
- Manual (not automatable per repo conventions — no CSS/breakpoint testing): `npm run web:dev`,
  sign in as a user with a team but no leagues, visit `/`, and confirm:
  - The "You're riding solo" card (dashed border + `Gauge` icon + heading + supporting copy)
    renders in place of the leagues list.
  - **My Leagues** (outline, `Users`) navigates to `/leagues`; **Browse public** (primary,
    `Search`) navigates to `/browse-leagues`.
  - CTAs stack full-width on mobile, side-by-side at `md:`.
  - The rest of the page (identity header, next-race card, score cards) matches the full state.
  - Joining/creating a league swaps the card for the `MyLeaguesList`; a user with leagues still
    sees the list; a user with no team still sees `LeaguesNeedTeamNotice`.

## Acceptance criteria (from the issue, copy as settled with the user)

- [ ] `JoinLeaguesPrompt` renders in place of `MyLeaguesList` when `team` is present and
      `standings` is empty, with the **"You're riding solo"** heading and supporting copy.
- [ ] Two CTAs: **My Leagues** (outline, `Users` icon) → `/leagues`, and **Browse public**
      (primary, `Search` icon) → `/browse-leagues`.
- [ ] The rest of the page (identity header, next-race card, score cards) renders the same as the
      full state.
- [ ] When `standings` is non-empty, `MyLeaguesList` renders and `JoinLeaguesPrompt` does not
      appear.
- [ ] Tests ship with the change: `Home.test.tsx` (no-leagues render + CTA destinations +
      hidden-when-standings-present) and `root-routing.integration.test.tsx` (authed, team, no
      leagues → prompt at `/`).
- [ ] Copy diverges from the issue's table (heading / CTA labels / icons) per the user — see the
      Copy & icons section.
