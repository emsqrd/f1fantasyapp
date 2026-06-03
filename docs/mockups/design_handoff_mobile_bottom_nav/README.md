# Handoff: Mobile Bottom Navigation

## Overview
Today the app's primary navigation lives entirely inside the sidebar, which collapses behind a hamburger/drawer on mobile (`<768px`). The top-level destinations (My Team, My Leagues, Browse Leagues) are therefore invisible by default on phones — there's no obvious way to reach your team from the home page without discovering and opening the drawer.

This change introduces a **persistent mobile bottom navigation bar** so the core destinations are always visible in the thumb zone. **Desktop is unchanged** — it keeps the existing sidebar. The two presentations are driven by **one shared nav definition** so they can never drift out of sync.

Three decisions are baked into this design (each was explored and chosen over alternatives):
1. **Bottom-bar style:** edge-to-edge, solid, hairline top border. Active tab = primary color + slightly heavier icon/label. (Chosen over floating/pill/indicator/raised variants.)
2. **No-team state:** the bar shows **Home only**. The other destinations don't exist until the user has a team. "Create Team" is **not** a nav item — it's the action in the existing Home hero (`CreateTeamHero`).
3. **Account menu:** profile / theme / sign-out are **not** bottom-bar tabs. On mobile they move to a **top bar** (top-right avatar), mirroring the sidebar footer on desktop.

## About the Design Files
The files in this bundle are **design references created in HTML/React-in-Babel** — a clickable prototype showing the intended look and behavior. They are **not** production code to copy directly. The task is to **recreate these designs inside the existing `web/` codebase** (React 19 + TypeScript + Tailwind v4 + shadcn/ui + TanStack Router), using its established components, tokens, and patterns — not to import the prototype's inline-styled JSX.

The prototype hard-codes design tokens (lifted from `web/src/index.css`) and re-implements small pieces of the app (Home cards, account menu, avatar) purely so the nav can be shown in context. In the real implementation, reuse the app's actual components; only the **navigation** pieces below are new.

## Fidelity
**High-fidelity.** Colors, typography, spacing, icon choices, and interactions are final and specified exactly below. Recreate the bottom bar and mobile top bar pixel-faithfully using the codebase's existing primitives (shadcn `Avatar`, `DropdownMenu`, lucide icons, Tailwind tokens). Where the prototype draws iOS chrome (status bar, home-indicator pill), that's just device framing — **do not** build it; use `env(safe-area-inset-bottom)` instead (see notes).

---

## Architecture — the core of this change

### 1. Single nav definition (source of truth)
Create one hook that is the **only** place destinations are defined. Both the desktop sidebar and the mobile bottom bar consume it. Adding a destination here surfaces it in both, with no second list to maintain.

```ts
// web/src/hooks/useNavDestinations.ts  (NEW)
import { useTeam } from '@/hooks/useTeam';
import { Home, Users, ChartNoAxesGantt, Search, type LucideIcon } from 'lucide-react';

export interface NavDestination {
  key: string;
  title: string;        // full label (sidebar)
  short: string;        // compact label (bottom bar)
  icon: LucideIcon;
  to: string;           // TanStack Router path
}

export function useNavDestinations(): NavDestination[] {
  const { hasTeam } = useTeam(); // however team presence is read today

  const items: NavDestination[] = [
    { key: 'home', title: 'Home', short: 'Home', icon: Home, to: '/' },
  ];
  if (hasTeam) {
    items.push(
      { key: 'team',    title: 'My Team',        short: 'Team',    icon: Users,            to: '/my-team' },
      { key: 'leagues', title: 'My Leagues',     short: 'Leagues', icon: ChartNoAxesGantt, to: '/leagues' },
      { key: 'browse',  title: 'Browse Leagues', short: 'Browse',  icon: Search,           to: '/browse-leagues' },
    );
  }
  return items;
}
```

> **Icon choices (final):** Home → `Home`, My Team → `Users`, My Leagues → `ChartNoAxesGantt` (chart-no-axes-gantt), Browse Leagues → `Search`. Note these may differ from the icons currently in `AppSidebar.tsx` — adopt these.

> **No-team behavior:** the hook returns **Home only** when there's no team. Because both presentations render the same list, the sidebar **and** the bottom bar automatically show Home only — no separate "no-team bar." This is the whole point: define once, render twice.

> **"Create Team" is not in this list.** It's an action, reached from the existing Home `CreateTeamHero` button → `/create-team`. Do not add it as a nav destination.

### 2. Two thin presentations
- **`AppSidebar`** (desktop, existing): refactor it to map over `useNavDestinations()` instead of building items inline. Keep everything else (header, account dropdown in the footer) as-is.
- **`MobileBottomNav`** (mobile, NEW): maps over the same hook. Spec below.

### 3. Viewport switch
Use the existing `use-mobile.ts` hook (`MOBILE_BREAKPOINT = 768`). At `<768px`: hide the sidebar/drawer's primary nav, render `<MobileBottomNav />` fixed at the bottom **and** `<MobileTopBar />` at the top (for the account menu). At `≥768px`: the sidebar as today; no bottom bar, no mobile top bar.

### 4. Account menu relocation (mobile)
On desktop the account menu stays in the sidebar footer. On mobile, the bottom bar is **destinations only** — so render the account control in a **top bar** (top-right avatar → existing account `DropdownMenu`). Reuse the same menu contents already used in the sidebar footer (profile, theme toggle, sign out); just anchor it from the mobile header.

### 5. Routing note (decide explicitly)
The destinations `/my-team`, `/leagues`, `/browse-leagues` currently sit under the `_team-required` pathless layout, whose `requireTeam` guard (`web/src/lib/route-guards.ts`) **redirects no-team users to `/create-team`**. Because the nav hook already **omits** those destinations when there's no team, a no-team user can't tap them — so the guard never fires from nav. **No guard change is required** for this design. (Leave `route-guards.ts`, `router.tsx`, and their integration tests untouched.)

---

## Components

### MobileBottomNav (NEW)
Fixed, edge-to-edge bar pinned to the bottom of the viewport; page content scrolls underneath.

**Container**
- `position: fixed; left/right/bottom: 0; z-index:` above content, below modals/sheets.
- `background: var(--background)`; `border-top: 1px solid var(--border)`.
- Bottom padding for the home indicator / gesture area: `padding-bottom: env(safe-area-inset-bottom)`. **Do not** recreate the prototype's grey pill — that's iOS device chrome.
- Inner row: `display:flex; align-items:stretch; padding: 6px 6px 2px;`.

**Each tab (button)**
- `flex: 1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; min-height:46px; padding:4px 0;` (≥44px tap target).
- Icon: lucide, **size 23px**. Stroke width **2** inactive / **2.3** active.
- Label: **font-size 10.5px**, weight **500** inactive / **650** active, `line-height:1; white-space:nowrap;`. Use the `short` label.
- Color: active = `var(--primary)`; inactive = `var(--muted-foreground)`.
- Active = the tab whose `to` matches the current route (use TanStack Router active state).
- Tapping navigates via `<Link to={dest.to}>`.

**Behavior**
- With no team the hook yields one destination, so the bar shows a single full-width **Home** tab. That's intended.
- Reduced motion: color transition only (`transition: color .18s`); no required motion.

### MobileTopBar (NEW)
Header shown only on mobile (`<768px`).
- Height **52px**; `display:flex; align-items:center; justify-content:space-between; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--background);`.
- **Left:** brand — lucide `Trophy` icon 21px in `var(--primary)` + wordmark "F1 Fantasy" at 16px / weight 700 / letter-spacing -0.02em. (Match whatever brand lockup the sidebar header uses.)
- **Right:** avatar button (32px) that opens the existing account `DropdownMenu`.
- No notification bell or other actions — destinations live in the bottom bar, account lives here.

### Account menu (reuse existing)
Anchored from the mobile top-bar avatar. Same contents as the sidebar footer dropdown:
- Header row: avatar (36px) + display name (13.5px/600) + email (12px, muted), truncated.
- `My Account` — lucide `BadgeCheck` 16px.
- `Theme` — segmented control of three options: Light (`Sun`), Dark (`Moon`), System (`Monitor`). Active option = primary tint background + primary text.
- `Sign Out` — lucide `LogOut` 16px.

### Avatar (match existing)
shadcn `Avatar`, `rounded-lg` (= `calc(var(--radius) - 2px)`), `h-8 w-8` in chrome. Shows the user image if present, else the `CircleUser` fallback glyph on a `var(--muted)` background with `var(--muted-foreground)` foreground. (The prototype's blue-gradient initials avatar was a mistake — use the real `Avatar`/`CircleUser` fallback.)

### AppSidebar (existing — refactor only)
- Replace the inline item construction with `.map(useNavDestinations())`.
- Active item styling unchanged (`var(--sidebar-accent)` background, `var(--sidebar-accent-foreground)`).
- With no team it now naturally shows **Home only** (no "Create Team" nav item, no locked items). The Create Team CTA remains the Home hero.
- Keep the account dropdown in the footer for desktop.

---

## Screens / Views (what the prototype demonstrates)

1. **Home · has team (mobile)** — bottom bar shows Home (active) · Team · Leagues · Browse. Top bar shows brand + avatar.
2. **Home · no team (mobile)** — bottom bar shows **Home only**. Home page renders the existing `CreateTeamHero` whose "Create team" button → `/create-team`.
3. **Create Team page** — the existing `CreateTeam` component (centered card: "Create Your Team" / "Choose a name for your fantasy F1 team" / Team Name field with "You can change this later" / "Create Team" button). Unchanged; just reachable from the Home hero.
4. **Account menu open (mobile)** — popover from the top-right avatar.
5. **Desktop (≥768px)** — sidebar unchanged; same destinations, including Home-only when no team.

## Interactions & Behavior
- **Tab tap:** navigate to `dest.to`; active tab reflects current route.
- **Avatar tap (mobile):** toggle account dropdown.
- **Create team:** Home hero button → `/create-team`; on success the app already flips to has-team, at which point the bottom bar and sidebar both reveal Team / Leagues / Browse.
- **Responsive:** bottom bar + mobile top bar appear only `<768px`; sidebar only `≥768px`. No overlap.
- **Safe area:** honor `env(safe-area-inset-bottom)` so the bar clears the iOS home indicator.

## State Management
- Team presence from the existing team context/hook (`useTeam` or equivalent) — drives `useNavDestinations`.
- Active route from TanStack Router.
- Account dropdown open/close — local state (or the shadcn `DropdownMenu`'s own).
- Theme — existing theme provider.
- **No new global state.**

## Design Tokens (from `web/src/index.css` — use the CSS variables, not these literals)
| Token | Light | Dark |
|---|---|---|
| `--background` | `#ffffff` | `#09090b` |
| `--foreground` | `#09090b` | `#fafafa` |
| `--primary` | `#1447e6` | `#2b7fff` |
| `--primary-foreground` | `#eff6ff` | `#eff6ff` |
| `--muted-foreground` | `#71717b` | `#9f9fa9` |
| `--border` | `#e4e4e7` | `rgba(255,255,255,.10)` |
| `--sidebar` | `#fafafa` | `#18181b` |
| `--sidebar-accent` | `#f4f4f5` | `#27272a` |
| `--muted` | `#f4f4f5` | `#27272a` |
| `--radius` | `0.65rem` | `0.65rem` |

Bottom-bar specifics: icon 23px (stroke 2 / 2.3), label 10.5px (500 / 650), tab min-height 46px, row padding `6px 6px 2px`. Top bar height 52px.

## Assets
- **Icons:** lucide-react (`Home`, `Users`, `ChartNoAxesGantt`, `Search`, `CircleUser`, `BadgeCheck`, `Sun`, `Moon`, `Monitor`, `LogOut`, `Trophy`). No custom SVGs.
- **Brand mark:** existing F1 Fantasy lockup / `public/f1_fantasy_favicon.svg`.
- No images introduced by this change.

## Files in this bundle (design references only)
- **`Mobile Bottom Nav (standalone).html` — open this one.** A single self-contained file that works offline: just double-click it. Interact with the prototype (toggle has-team / no-team, open the account menu, tap tabs, run the Create Team flow).
- `Mobile Bottom Nav.html` — the same prototype, but split across the `bottom-nav/` source files below. This version must be **served over http** (e.g. `npx serve` in this folder), not opened via `file://`, or it renders blank.
- `bottom-nav/app.jsx` — canvas composition + the interactive hero (reference for states/flows).
- `bottom-nav/bottom-bars.jsx` — `BottomNav` (the edge-solid mobile bar) — closest reference for `MobileBottomNav`.
- `bottom-nav/shells.jsx` — `MobileTopBar`, account popover, `DesktopSidebar` reference.
- `bottom-nav/chrome.jsx` — `useNavDestinations` reference, account menu, avatar, Home/Create-Team screens, design tokens.
- `bottom-nav/icons.jsx` — the exact lucide glyphs used (for visual matching).
- `bottom-nav/design-canvas.jsx` — presentation scaffold only; **not** part of the feature.

## Implementation checklist
- [ ] Add `useNavDestinations()` hook (single source of truth; Home-only when no team; icons as specified).
- [ ] Refactor `AppSidebar` to consume the hook (no behavior change on desktop).
- [ ] Build `MobileBottomNav` (edge-solid spec) consuming the hook; show only `<768px`.
- [ ] Build `MobileTopBar` (brand + avatar→account menu); show only `<768px`.
- [ ] Ensure the mobile sidebar drawer no longer carries the primary destinations (they're in the bottom bar now); keep the drawer only if something else still needs it.
- [ ] Honor `env(safe-area-inset-bottom)`.
- [ ] Verify no-team shows Home only in both presentations; Create Team remains the Home hero CTA.
- [ ] Leave route guards and their tests unchanged.
