# ADR 001: Supabase Connection Strategy for Render Free Tier

**Date:** 2026-02-18
**Status:** Accepted

## Context

The F1 Fantasy API runs on Render's free tier and connects to a PostgreSQL database hosted on Supabase's free tier. Two platform constraints collide:

1. **Supabase switched direct database connections to IPv6-only** (Feb 2024). The IPv4 add-on requires a paid plan ($4/month).
2. **Render's free tier does not support IPv6 outbound connections.**

This means the API cannot reach Supabase's direct connection host (`db.cfuccajsckqzecbfyqrv.supabase.co`). All database traffic must go through **Supavisor**, Supabase's connection pooler (`aws-1-us-east-2.pooler.supabase.com`), which supports IPv4.

Supavisor offers two connection modes:
- **Session mode** (port 5432) — binds a backend Postgres connection to the client connection for its lifetime. Suitable for persistent servers.
- **Transaction mode** (port 6543) — returns the backend connection to Supavisor's pool after each transaction. Designed for serverless/short-lived connections.

Supabase free tier limits:
- Max database connections: 60
- Max pooler client connections: 200
- Backend connections per user/db/mode (Supavisor pool size): ~15-20

Npgsql (the .NET PostgreSQL driver) defaults to `Maximum Pool Size=100`, which silently exceeds Supavisor's per-user pool size limit.

## Decision

Use **session mode (port 5432)** via Supavisor with `Maximum Pool Size=10` in the Npgsql connection string, combined with EF Core's retry-on-failure (3 retries, 5-second max delay).

Connection string format:
```
User Id=postgres.<project-ref>;Password=<pw>;Server=aws-1-us-east-2.pooler.supabase.com;Port=5432;Database=postgres;SSL Mode=Require;Maximum Pool Size=10
```

EF Core configuration (in `ServiceExtensions.cs`):
```csharp
options.UseNpgsql(connectionString, npgsqlOptions =>
    npgsqlOptions.EnableRetryOnFailure(
        maxRetryCount: 3,
        maxRetryDelay: TimeSpan.FromSeconds(5),
        errorCodesToAdd: null
    ))
```

## Consequences

**What this enables:**
- Stable database connectivity from Render free tier to Supabase free tier
- Session mode keeps backend connections tied to client connections — no per-query reconnection overhead
- Pool size of 10 stays safely within Supavisor's ~15-20 backend connection limit
- EF Core retry handles transient failures (cold starts, brief Supavisor hiccups)

**Limitations:**
- Maximum 10 concurrent database connections, limiting API concurrency under load
- Still dependent on Supavisor as an intermediary (adds slight latency vs. direct connections)
- Supabase has no .NET/Npgsql-specific documentation — future Supavisor changes may require re-investigation

**If moving off free tier:**
- Upgrading Supabase to a paid plan enables direct IPv4 connections, removing the Supavisor dependency entirely
- Upgrading Render would allow IPv6, also enabling direct connections
- Either upgrade would allow increasing `Maximum Pool Size` and removing the Supavisor middleman

## Post-Deployment Investigation (2026-02-21)

### Status: Root cause identified, mitigation deployed (incomplete)

A thorough multi-phase investigation using Sentry error data, Render logs, Supabase logs, and git history revealed a more complex reality than initial hypothesis.

**Key findings:**

1. **Error rate was NOT hidden — it was real and increasing**
   - Sentry active since Nov 2025 (would have caught earlier errors)
   - Dec 14, 2025: First DB issue appeared (`DbCommand` 45s slow queries)
   - Jan 11, 2026: Pool exhaustion errors (`MaxClientsInSessionMode`)
   - Feb 16, 2026: TCP-level connection failures emerged (completely new failure mode)
   - Error rate accelerated: Feb 7-10 (1), Feb 14-17 (270), Feb 18-21 (415)

2. **What changed in mid-February**
   - 9 merges to main in 1 week (vs. 3 the previous week) = many cold starts
   - Race/Season features deployed Feb 5, increasing DB calls per session
   - UX redesign deployed Feb 16, increased page load frequency
   - `EnableRetryOnFailure` added Feb 16 — meant to help but **tripled** TCP connection attempts (1 timeout → 3 timeouts)
   - Pool exhaustion fixed Feb 18 with `Maximum Pool Size=10`, but TCP failures continued

3. **Root cause is multi-layered, not a single tuning issue**
   - **Layer 1:** Render free tier drops outbound TCP packets (confirmed: "our GCP gateway was indeed dropping packets")
   - **Layer 2:** Supavisor has `client_idle_timeout` that closes idle connections on free tier (not configurable)
   - **Layer 3:** Npgsql default `Minimum Pool Size=0` allows pool to drain, forcing expensive reconnections
   - All three layers must align badly simultaneously for failures to occur

4. **Failures are NOT just cold-start failures**
   - Timeline analysis shows failures on FIRST connection attempt (pool empty, no eviction)
   - Some instances failed continuously for 10+ minutes even when API was running
   - When connections succeed after failure, they take 2-4s (Supavisor warming), not 15s timeout
   - Bimodal distribution (success or complete failure) suggests **packet drops**, not latency

**Mitigation (in code, not yet deployed):**
1. **`Timeout=30`** — allows more time for TCP handshake, helps cold-start case
2. **DB warmup at startup** — absorbs startup connection latency before first user request

**Why mitigation is incomplete:**
- Mid-lifecycle failures (after pool eviction or connection reuse) still hit unreachable Supavisor
- Dropped packets don't become less dropped just because timeout is longer
- Warmup only covers app startup, not subsequent request bursts

**Why the problem only became visible in mid-February:**
- App functionality grew (new endpoints, more DB calls per session)
- Deployment frequency increased (more cold starts)
- Retry strategy was added (amplified error count 3x)
- More people may have been using the app
- Underlying infrastructure flakiness was always there, but error rate is proportional to connection attempt frequency

**Long-term options:**
1. **Proper fix:** Upgrade Supabase to paid plan for direct IPv4 ($4/month) or Render for IPv6 — removes Supavisor
2. **Better mitigation:** Set `Minimum Pool Size=1` to keep connection alive (let Keepalive pings prevent tenant pool cold start)
3. **Architectural change:** Use Supabase REST API instead of raw TCP (bypasses Supavisor entirely)
4. **Accept the limitation:** Document as a known issue of free-tier deployment

## Alternatives Considered

### Session mode with default pool size (Attempt 1)
Session mode on port 5432, but with Npgsql's default `Maximum Pool Size=100`. Supavisor rejected connections with `MaxClientsInSessionMode` errors because 100 far exceeds the ~15-20 backend connection limit per user/db/mode.

### Transaction mode (Attempt 2)
Transaction mode on port 6543 returned the physical Postgres connection to Supavisor's pool after every query. Each subsequent EF Core query re-established a physical connection through Supavisor, adding ~7.5 seconds per query. Intermittent TCP timeouts to Supavisor compounded the problem. Transaction mode is designed for serverless workloads, not persistent API servers.

### Transaction mode with multiplexing (Attempt 3)
Adding `Multiplexing=true` to the connection string kept existing Npgsql connections alive (0ms reopens), but new TCP connections to Supavisor still intermittently timed out. Npgsql's multiplexing is also experimental and not validated with Supavisor.
