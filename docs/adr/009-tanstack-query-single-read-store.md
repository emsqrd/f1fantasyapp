# ADR 009: TanStack Query Is the Single Read Store

**Date:** 2026-06-21
**Status:** Accepted (supersedes ADR 006)

## Context

ADR 006 adopted TanStack Query for cross-route reads and concluded that two caches — the router's loader cache (`useLoaderData`) and the Query cache — would coexist "by design," split on access pattern rather than entity. In practice that boundary turned every read into a per-read judgment ("which cache does this belong in?"), and the documentation that enumerated the split kept going stale as reads moved (the placement inventories in ADR 006 and `web/CLAUDE.md` rotted; #302).

Two facts reframe the original split:

- **Where a read is cached is independent of whether its surface blocks or streams.** Blocking is achievable through Query (`ensureQueryData` in a loader), so the loader cache is not required in order to block. Whether a surface awaits its reads before render or streams them in is a separate, load-strategy question — the React Suspense single-versus-nested-boundary axis; TanStack Router's deferred data loading — and is unaffected by this record.
- **Running two caches is the integration TanStack explicitly advises against.** The documented Router + Query pattern is to let Query own caching outright and treat the loader as a cache-priming step, not a store.

## Decision

TanStack Query is the single read store.

- A read is defined once as `queryOptions` in a per-resource factory. A guard or loader that must have the data before render calls `context.queryClient.ensureQueryData(...)` to prime and block, and **returns nothing**; the component reads through `useSuspenseQuery` (when a loader guarantees the data) or `useQuery` (when the read loads independently of the route). `useLoaderData` is no longer a data-read path.
- The router's built-in caching is disabled (`defaultPreloadStaleTime: 0`) so it does not compete with Query's freshness logic. Per-route `staleTime`/`gcTime` give way to each query's own freshness window.
- Whether a surface blocks on a read or streams it in remains governed separately (ADR 008); both routes read through the Query cache here.

## Consequences

- The "which cache does this read belong in" judgment is gone. The only remaining read-placement choice — block or stream — no longer changes *where* data lives, only how the loader treats the query.
- Cache invalidation unifies on `invalidateQueries`. The prior split had divergent semantics: `router.invalidate()` re-runs loaders, but `ensureQueryData` then serves the stale cache entry, so route invalidation silently failed to refresh Query-backed reads.
- Reads that predate this decision still return data from loaders; they migrate incrementally rather than in one step, and the codebase converges on the rule. The operational convention lives in `web/CLAUDE.md`; migration is tracked separately.

## References

- Supersedes only ADR 006's two-cache thesis (caches coexisting, split by access pattern). ADR 006's failure-vs-absence seam — transient failures throw, 404 maps to absence (#249) — is unaffected, and is generalized by ADR 008.
- ADR 008 governs the orthogonal load-strategy question (await a read versus stream it) and is unaffected.
- TanStack's documented Router + Query integration: loaders `ensureQueryData`, components `useSuspenseQuery`/`useQuery`, `defaultPreloadStaleTime: 0`.
