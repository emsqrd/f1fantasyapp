# Handoff: Leaderboard Redesign

## Overview

A redesign of the league leaderboard for the F1 Fantasy app. Replaces the current 2-column table (Rank, Team) with a richer, hierarchically-clear design that surfaces all six required data points: team name, owner name, position, total points, position change since last round, and a row click-through to the team page.

**Target file in your repo:** `web/src/components/Leaderboard/Leaderboard.tsx`

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look and behavior, not production code to copy directly. Recreate this design in the existing React + Tailwind + shadcn/ui codebase using the established patterns (TanStack Router, route loader data, contracts in `@/contracts/`, shadcn primitives in `web/src/components/ui/`).

The prototype uses inline CSS variables (`var(--foreground)`, `var(--muted-foreground)`, etc.) that match the project's existing tokens in `web/src/index.css`. In the real codebase, prefer Tailwind class shortcuts (`text-foreground`, `bg-card`, `border-border`) which the project already uses.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate pixel-perfectly using the codebase's existing libraries.

## Final Decisions (Tweak Values Locked)

The prototype exposes a Tweaks panel during design exploration. The following values are **locked as final** — do not expose any of these as runtime user preferences:

| Tweak          | Locked value                            | Notes                                          |
| -------------- | --------------------------------------- | ---------------------------------------------- |
| `layout`       | `table` on desktop, `card` on mobile    | Auto-swaps below 640px viewport                |
| `density`      | `comfortable`                           | `py-3` row padding                             |
| `myRowStyle`   | `both` (tint + border)                  | The viewer's own row gets both treatments      |
| `tintStrength` | `17%`                                   | See Design Tokens for the color-mix expression |
| `glyphStyle`   | `arrow` (↑ / ↓)                         | Single-line arrows for position deltas         |
| `dark`         | follow system / existing app preference | Don't ship a per-component toggle              |
| `preview`      | N/A                                     | iPhone-frame preview was a design tool only    |

## Layouts

### Desktop — Table variant (≥ 640px)

A 5-column CSS grid (not an HTML `<table>` — see Components below):

```
gridTemplateColumns: '52px 1fr 70px 96px 36px'
                      Pos   Team Move Pts    Chevron
```

- **Header row:** small caps, `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`, background `bg-secondary`, padding `px-4 py-2.5`
- **Body rows:** `px-4 py-3`, border-bottom `border-border`, hover `bg-accent`, click navigates to team page
- Whole row is a `<button>` for keyboard + click affordance (with `aria-label`)

### Mobile — Card variant (< 640px)

Vertical stack of card buttons, `gap-2`:

- Card: `rounded-[0.65rem] border bg-card p-3`, hover `-translate-y-px hover:shadow-sm`
- Layout inside: `flex items-center gap-3` — rank number (left), team+owner+delta block (center, `flex-1`), points (right)
- Chevron hidden on mobile (`hidden sm:block`)

### Auto-swap

A `useIsNarrow(640)` hook listens to viewport width. Below 640px the table layout is forced to card regardless of the locked default, because fixed grid columns don't fit in a phone viewport. This is layout-driven, not user-driven — it just happens.

## Components

### Position number (rank)

Plain typographic treatment, no avatar, no medal-tinted circle:

- Font: `font-mono font-semibold tabular-nums`, size `16px`
- Color: `var(--foreground)` for top 3, `var(--muted-foreground)` for the rest
- Centered in a fixed-width column

### Team + Owner block

```
Team Name              ← truncate font-semibold text-foreground
Owner Name             ← text-[12px] text-muted-foreground
```

The user's own row uses the **real owner name** (no "You" badge). The row's visual treatment (tint + border) is the only "this is you" signal.

### PositionDelta (Move column)

Just a colored glyph + number, no pill background. Header column label is **"Move"** (not Δ).

- Up: `↑ 3` in green (`var(--delta-up-fg)`)
- Down: `↓ 1` in red (`var(--delta-down-fg)`)
- Flat: just `–` in `var(--muted-foreground)`
- Glyph size: `text-[12px] leading-none`, number: `text-[12px] font-semibold tabular-nums`
- `aria-label`: "Up N positions" / "Down N positions" / "No position change"

### Total points

`font-mono text-[15px] font-semibold tabular-nums text-foreground`, right-aligned. Use `toLocaleString()` for thousand separators.

### "My team" row treatment

Two layered effects, both applied:

1. **Tint** — full row background:
   `bg-[color-mix(in_oklab,var(--row-highlight)_var(--row-highlight-strength),transparent)]`
   In the table; for the card variant the mix is over `var(--card)` instead of `transparent`.
2. **Border** — table: `box-shadow: inset 0 0 0 1.5px var(--row-highlight-border)`. Card: `border-[var(--row-highlight-border)]` replaces the default border.

Tint and border are deliberately in the same hue family so they read cohesively (GitHub-style).

### Header

```
{league.name}                     ← text-[24px] sm:text-[28px] font-bold tracking-tight
{league.description}              ← text-[13px] text-muted-foreground, max-w-[52ch]

[ Round 7 / 24 ] [ After GP Race ] [● Next MIA Sprint · Sat 7:30 PM ]
```

The chip row is wrapped in horizontal scroll on mobile (`-mx-4 overflow-x-auto px-4 pb-1`) with hidden scrollbars; on desktop it wraps. The "Next" chip uses primary-tinted styling (the only on-brand-color element in the header).

The third chip's data (next session label + time) comes from `RaceWeekend` — pick the next non-completed session in the current weekend (`weekendFormat: 0` = standard, `1` = sprint).

## Interactions & Behavior

- **Row click** → navigate to team page. Use the existing `Link` patterns from `@tanstack/react-router`:
  - Own team: `<Link to="/my-team">`
  - Others: `<Link to="/team/$teamId" params={{ teamId: String(team.id) }}>`
- **Hover (desktop):** row gets `bg-accent` background. Cards get `hover:-translate-y-px hover:shadow-sm`.
- **Focus-visible:** `ring-2 ring-ring` on rows and cards.
- **Empty state:** if `league.teams.length === 0`, render existing fallback (`bg-card rounded-lg p-8 text-center` with "No teams in this league yet.").

## Data Contract

Position change **is not currently in `Team`**. You'll need to add it:

```ts
// web/src/contracts/Team.ts
export interface Team {
  // ... existing fields
  positionChange: number; // +N moved up, -N moved down, 0 flat
  // computed server-side: previousPosition - currentPosition
  // (or null if this is round 1 / no prior data)
}
```

If `positionChange` is `null`/undefined, render the flat `–` glyph (treat as zero).

Position itself is the row's index in `league.teams` after sort by `totalPoints` desc — same as today.

## Design Tokens

These are added on top of the existing `web/src/index.css` palette:

```css
:root {
  /* row-highlight: tint fill + matching border for the viewer's own row.
     Light mode uses a soft sky-blue family — fill is desaturated,
     border is a touch deeper but in the same blue conversation. */
  --row-highlight: oklch(60% 0.13 250);
  --row-highlight-border: oklch(78% 0.09 250);

  /* delta colors */
  --delta-up-fg: #16a34a;
  --delta-down-fg: #dc2626;
  --delta-flat-fg: #71717a;
}

.dark {
  --row-highlight: var(--primary);
  --row-highlight-border: color-mix(in oklab, var(--primary) 55%, transparent);

  --delta-up-fg: #4ade80;
  --delta-down-fg: #f87171;
  --delta-flat-fg: #9f9fa9;
}
```

The `--row-highlight-strength` is set as `17%` and is no longer dynamic — fold it directly into the `color-mix(...)` expression at usage sites if you prefer not to expose the variable.

## Files in this bundle

- **`Leaderboard.html`** — entry point. Open in a browser to view the running prototype.
- **`leaderboard.jsx`** — all React components (TableVariant, CardVariant, PositionDelta, RankNumber, LeaderboardHeader, etc.). The Podium variant exists in source but is not part of the final design — ignore it.
- **`data.jsx`** — mock data (teams, league, race weekend). Replace with real data from the route loader.
- **`tweaks-panel.jsx`** / **`ios-frame.jsx`** — design-tool scaffolding only. Do not port.

## Things the prototype fakes

- All team names, owner names, and points are mock data.
- The Tweaks panel is a design tool, not part of the shipped UI.
- The team detail page beyond the header is a stub. **Out of scope for this handoff** — keep the existing `/team/$teamId` route as-is.
- The iOS frame is a preview tool; the real app already runs on real devices.

## Accessibility

- The viewer's own row passes WCAG 1.4.11 (Non-text Contrast, 3:1) via the **border** — `var(--row-highlight-border)` against `var(--card)` is well above threshold in both modes. The tint alone does not pass; ship both layers.
- Each row is a `<button>` (or `<Link>` rendered as button) with `aria-label` "Open {team name}, position {N}".
- Move column has `aria-label` for screen readers; glyphs are `aria-hidden`.
- All numbers use `tabular-nums` so columns align without jitter.
