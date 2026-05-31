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

The issue's copy table specified "You're flying solo" / "Create a league" with two CTAs. The final
design was worked out with the user and **intentionally differs** — the card surfaces a **single,
join-focused CTA** and deliberately does **not** offer "create a league." Build exactly this:

| Element                 | Final                                                            |
| ----------------------- | --------------------------------------------------------------- |
| Heading                 | **You're riding solo**                                          |
| Supporting copy         | **You've got the team — now you need a grid.**                  |
| Media icon (large, top) | **`Gauge`**                                                     |
| CTA                     | **Browse leagues** — primary button, **`Search`** icon, → `/browse-leagues` |

- **Why join-only, no "create a league."** Creating a league has **no first-class entry point** in
  the app — it is not a route or a page, only a `CreateLeague` dialog mounted behind a "Create
  League" button on the My Leagues page (`/leagues`). So a card CTA for "create" can't honestly
  point anywhere: a navigation button would dump the user one step short (land on `/leagues`, then
  hunt for another "Create League" button), and making it open the dialog directly would require
  new deep-link plumbing (a route search param + a controllable dialog) beyond the scope of this
  card. Rather than ship a dishonest or half-wired create button, the card leads with the one
  action it _can_ deliver cleanly — **joining** — and creating stays discoverable where it already
  lives: the **My Leagues** sidebar item. (Considered and rejected: a two-CTA "My Leagues / Browse
  public" card — "My Leagues" reads as a destination, not a create action, and tells a user with
  zero leagues nothing about how to start one.)
- **Browse is an honest destination.** `/browse-leagues` is a real page listing public leagues,
  each with its own "Join League" action — so a user genuinely browses-then-joins there. The button
  label mirrors the app's own **Browse Leagues** sidebar item and reuses its **`Search`** icon. The
  large media icon is **`Gauge`** (a racing cue), kept distinct from the no-team card's **`Users`**
  media icon.
- **Supporting copy is a hook, not instructions.** It motivates ("now you need a grid") and lets
  the single CTA carry the action — it deliberately does not narrate button labels or name
  navigation.

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
import { Gauge, Search } from 'lucide-react';

export function JoinLeaguesPrompt() {
  return (
    <Empty className="border">
      <EmptyHeader className="max-w-md">
        <EmptyMedia variant="icon">
          <Gauge />
        </EmptyMedia>
        <EmptyTitle>You're riding solo</EmptyTitle>
        <EmptyDescription>You've got the team — now you need a grid.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link to="/browse-leagues">
            <Search />
            Browse leagues
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
- **Description width:** `EmptyHeader` is given `className="max-w-md"`, overriding the primitive's
  base `max-w-sm` (same `tailwind-merge` group → the wider cap wins) so the description can run
  wider before wrapping. With the current short hook the text fits on one line, so the cap is only
  visible if the copy grows.
- **Icons** need no sizing/margin — `Button`'s base styles size the `Search` SVG to `size-4` and
  add `gap-2`. The large `<Gauge />` is left unsized so `EmptyMedia variant="icon"` sizes it to
  `size-6`.
- **CTA** is a plain `<Link>` wrapped by `Button asChild`, so the component stays presentational
  (no `useNavigate`/state). The button's text is its accessible name (icon decorative).
- Raw apostrophes in "You're" / "You've" are fine (repo precedent: `LeaguesNeedTeamNotice.tsx`,
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
  - single link named `Browse leagues` → `href="/browse-leagues"`.
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
- The real router renders the card's `<Link to="/browse-leagues">` fine in this harness — the
  existing authed-with-standings test already renders typed `Link`s (e.g. `<Link to="/leagues">`
  via `MyLeaguesList`) against the same single-route test tree, so the card's link resolves here.

**Gate:** build/lint/test/format all pass.

---

## Key implementation notes

- **Run `npm run web:format` before each commit.** `prettier-plugin-tailwindcss` auto-sorts
  `className` strings; unsorted classes fail `web:format:check` in CI.
- **`src/components/ui` is vendored / eslint-ignored** — never edit `empty.tsx` or `button.tsx`;
  compose around them.
- **`no-unused-vars` is `error`** — keep imports tight.
- Lucide imports in `JoinLeaguesPrompt`: `Gauge`, `Search`. No `Users` (the second CTA was dropped)
  and no `Plus` (the issue's icon) — see the Copy & icons section.

## Testing strategy alignment

- **Branch logic at the lowest layer.** The three-way `team` / `standings` conditional is
  exercised in `Home.test.tsx` (no-team, no-leagues, has-leagues). `MyLeaguesList`'s own row/empty
  logic stays in `MyLeaguesList.test.tsx` — not re-walked.
- **One happy path higher up.** The integration test gets a single assertion (the no-leagues route
  renders the prompt), proving route/loader wiring; it does not re-assert the child matrix.
- **Leaf with no logic gets no own file.** `JoinLeaguesPrompt` is static JSX + one link — covered
  once through `Home.test.tsx`.
- **No new E2E.** A presentational branch over the same loader data — no new cross-system wiring,
  auth, or contract. The typed `Link to` is a build-time guarantee the route exists.

## Verification

- `npm run web:test` (unit + integration) — green; specifically the updated `Home.test.tsx` and
  `root-routing.integration.test.tsx`.
- `npm run web:lint`, `npm run web:format:check`, `npm run web:build` — clean.
- Manual (not automatable per repo conventions — no CSS/breakpoint testing): `npm run web:dev`,
  sign in as a user with a team but no leagues, visit `/`, and confirm:
  - The "You're riding solo" card (dashed border + `Gauge` icon + heading + supporting copy)
    renders in place of the leagues list.
  - **Browse leagues** (primary, `Search` icon) navigates to `/browse-leagues`.
  - The rest of the page (identity header, next-race card, score cards) matches the full state.
  - Joining or creating a league swaps the card for the `MyLeaguesList`; a user with leagues still
    sees the list; a user with no team still sees `LeaguesNeedTeamNotice`.

## Acceptance criteria (from the issue, copy as settled with the user)

- [ ] `JoinLeaguesPrompt` renders in place of `MyLeaguesList` when `team` is present and
      `standings` is empty, with the **"You're riding solo"** heading and supporting copy.
- [ ] A single CTA: **Browse leagues** (primary, `Search` icon) → `/browse-leagues`. Creating a
      league is **not** surfaced on the card (no first-class create entry point — it lives on the
      My Leagues page / sidebar).
- [ ] The rest of the page (identity header, next-race card, score cards) renders the same as the
      full state.
- [ ] When `standings` is non-empty, `MyLeaguesList` renders and `JoinLeaguesPrompt` does not
      appear.
- [ ] Tests ship with the change: `Home.test.tsx` (no-leagues render + browse CTA destination +
      hidden-when-standings-present) and `root-routing.integration.test.tsx` (authed, team, no
      leagues → prompt at `/`).
- [ ] Copy and CTA diverge from the issue's table (heading / single join CTA / icons) per the user
      — see the Copy & icons section.
