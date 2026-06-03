# ADR 005: Viewport-Divergent Navigation Shell via a JS Breakpoint, Not CSS Visibility

**Date:** 2026-06-03
**Status:** Accepted

## Context

Issue #230 gives mobile (`<768px`) a different navigation **shell** from desktop: a persistent bottom bar (destinations) plus a top bar (brand + account), in place of the desktop sidebar and its hamburger drawer. The two are not the same components restyled — they are **distinct component trees** (`MobileBottomNav` + `MobileTopBar` vs `AppSidebar` inside `SidebarProvider`).

That forces a choice in `Layout` about *how* to select between them. The default web convention is CSS responsive visibility — render both trees and hide one with `md:hidden` / `hidden md:flex`. The alternative is a JS breakpoint: render only one tree, chosen by `useIsMobile()` (which already exists and which the `Sidebar` primitive itself uses internally to decide Sheet-vs-fixed). This is a SPA with no SSR, so `useSyncExternalStore`'s snapshot reads `matchMedia` synchronously on first client paint — there is no wrong-state flash at load.

The decisive factor is the account menu. It appears in both shells (sidebar footer on desktop, top-bar avatar on mobile). Under CSS visibility, both `AccountMenu` instances mount simultaneously — duplicating the avatar trigger, its `avatarEvents` subscription, and the dropdown's accessible names in the DOM, which produces "found multiple elements" ambiguity in tests and redundant work at runtime.

## Decision

`Layout` renders **one** shell tree, selected by `useIsMobile()`. The mobile branch renders the top bar + bottom bar and **does not mount `SidebarProvider`, `AppSidebar`, the drawer, or the hamburger at all**; the desktop branch is the existing sidebar tree. The drawer is gone on mobile as a structural fact, not a CSS illusion, and exactly one `AccountMenu` instance exists in the DOM at any viewport.

## Consequences

- Crossing 768px remounts the shell subtree (the routed `Outlet` content re-renders; route data is cached). Acceptable for a viewport change.
- New mobile-divergent shell follows this pattern: branch in `Layout` (or a child) on `useIsMobile()`, don't render-both-and-hide.
- Tests must mock `matchMedia` (jsdom) to drive the switch; `useIsMobile`'s `matchMedia` dependency becomes load-bearing for layout, not just the sidebar's internal Sheet decision.
- This is presentation only — it does not change routing, guards, or which routes exist; it changes which shell wraps them.

## Alternatives Considered

### CSS responsive visibility (`md:hidden` / `hidden md:flex`)
The conventional approach. Rejected: it mounts both shells — and therefore two `AccountMenu`/avatar instances — at once, duplicating accessible names and `avatarEvents` subscriptions, which causes test ambiguity and needless DOM/work for no benefit here.

### Keep the sidebar drawer on mobile alongside the bottom bar
Rejected: once destinations live in the bottom bar and account lives in the top bar, nothing remains in the drawer. Keeping it would be a hidden, redundant second nav — the exact "out of sight" problem #230 exists to remove.
