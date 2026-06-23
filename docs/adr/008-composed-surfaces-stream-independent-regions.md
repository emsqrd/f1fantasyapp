# ADR 008: Composed Surfaces Stream Independent Regions; Single-Unit Surfaces Await All Reads

**Date:** 2026-06-16
**Status:** Accepted

## Context

A route that assembles several independent reads can fail in a way that punishes the user for one read's hiccup. The authenticated `Home` surface (`indexRoute`) builds three independent widgets — team header, league standings, upcoming race — from three reads awaited together; a transient failure of any one discards the whole surface to the route error component (the failure class behind #256). The same shape recurs in `NextRaceCard` (#223), and it caused #249.

## Decision

**A surface loads and fails per independent region only when both hold: (1) there is a useful partial render, and (2) no read is correctness-critical to the rest of the surface.** Otherwise it awaits all its required reads before rendering, and a failed required read surfacing as a whole-surface error is correct, not a bug.

- **Streams independent regions:** `Home`. The team header/score (identity) renders while standings and the next-race card stream in and fail independently. `NextRaceCard` likewise owns its own loading / empty / error / ideal states (#223).
- **Awaits all reads:** `account`, `leagues`, `browse-leagues`, `league detail`, the team builder. Each is one unit with no useful partial render; its loader throwing to the route error component is the intended behavior.

The team builder illustrates clause (2): it *has* a useful partial render (the roster could paint while lock state loads), yet it awaits all its reads because lock state is **correctness-critical** — an editable roster shown before lock state is known is unsafe. Correctness-criticality overrides partial-renderability.

**Both kinds preserve one invariant: a transient failure must never render as absence.** Expected absence has a designated signal — a `404` (→ `null` / empty / the no-X state). Transient failures (`5xx`, network, timeout) must surface as an error state and must never be funneled into the absence path. This is the seam #249 owns and the services already encode (return `null` on 404, throw otherwise).

This ADR governs *whether a surface streams its regions or awaits them as a whole* and *the failure-versus-absence rule*. It does **not** govern how a wait is represented (skeleton vs. spinner vs. nothing) — that is a per-surface styleguide convention, not an architectural decision.

## Consequences

- The app is **deliberately non-uniform**: most surfaces await all their reads, and only `Home` streams its regions. A reader should not "make it consistent" by streaming every surface — awaiting all reads on a single-unit surface is the correct choice under this rule.
- Classifying a surface is a judgment with two gates, not one. "Could this render partially?" is necessary but not sufficient; a correctness-critical read forces awaiting the whole even when a partial render exists.
- The instances live in #256 (Home streams its regions; standings degrades, summary stays a hard identity gate) and #223 (NextRaceCard's four states). Race-weekend reads are reshaped in #278.

## Alternatives Considered

### Stream every surface
Rejected — needless complexity and "spinner soup" on pages that are one logical unit with no useful partial state.

### Await all reads on every surface
Rejected — keeps `Home` hostage to its slowest or flakiest single widget; one transient failure discards a page the user could mostly see.

### Treat any failed read as absence (the status quo that caused the bugs)
Rejected — conflates "couldn't load" with "nothing here," which silently misinforms (#249 demoted team-owners; #223 showed "Season complete" for an unloaded schedule). The 404-versus-transient distinction is the fix.

## References

- Instances: #256 (Home), #223 (NextRaceCard). Race-weekend read reshape: #278.
- Builds on ADR 006 — the transient-failure-versus-genuine-absence seam (#249) this generalizes — and ADR 003 (the `indexRoute` loader that composes Home's reads).
