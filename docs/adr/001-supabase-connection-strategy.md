# ADR 001: Supabase Connection Strategy

**Date:** 2026-02-18
**Status:** Superseded (2026-02-21) — Migrated to Fly.io with direct Supabase connections

## Context (Render Era — Deprecated)

The F1 Fantasy API initially ran on Render's free tier and connected to Supabase's free tier via Supavisor. Two platform constraints collided:

1. **Supabase switched direct database connections to IPv6-only** (Feb 2024). The IPv4 add-on requires a paid plan ($4/month).
2. **Render's free tier does not support IPv6 outbound connections.**

This prevented direct connections. All database traffic had to go through **Supavisor**, Supabase's connection pooler (`aws-1-us-east-2.pooler.supabase.com`), which supports IPv4. Render's free tier would intermittently drop TCP packets to Supavisor, causing failures.

Supavisor offers two connection modes:
- **Session mode** (port 5432) — binds a backend Postgres connection to the client connection for its lifetime. Suitable for persistent servers.
- **Transaction mode** (port 6543) — returns the backend connection to Supavisor's pool after each transaction. Designed for serverless/short-lived connections.

Supabase free tier limits:
- Max database connections: 60
- Max pooler client connections: 200
- Backend connections per user/db/mode (Supavisor pool size): ~15-20

Npgsql (the .NET PostgreSQL driver) defaults to `Maximum Pool Size=100`, which silently exceeds Supavisor's per-user pool size limit.

## Original Decision (Deprecated)

Use **session mode (port 5432)** via Supavisor with `Maximum Pool Size=10`. This worked but was limited by Render's packet loss.

## New Decision (2026-02-21)

Migrate to **Fly.io** for reliable IPv6 outbound connectivity, enabling direct Supabase connections (IPv6-only). Use direct connection to `db.cfuccajsckqzecbfyqrv.supabase.co` without Supavisor.

Connection string format:
```
User Id=postgres;Password=<pw>;Server=db.cfuccajsckqzecbfyqrv.supabase.co;Port=5432;Database=postgres;SSL Mode=Require
```

**Key difference from Supavisor:** Use `User Id=postgres` (not `postgres.<project-ref>`). Supavisor requires the project ref suffix; direct connections use the base `postgres` user.

EF Core configuration (in `ServiceExtensions.cs`):
```csharp
options.UseNpgsql(connectionString, npgsqlOptions =>
    npgsqlOptions.EnableRetryOnFailure(
        maxRetryCount: 3,
        maxRetryDelay: TimeSpan.FromSeconds(5),
        errorCodesToAdd: null
    ))
```

## Consequences (Fly.io + Direct Connections)

**What this enables:**
- **No packet loss:** Fly.io has reliable outbound IPv6 to AWS/Supabase
- **No pooler overhead:** Direct connection bypasses Supavisor entirely, lower latency
- **Standard PostgreSQL client connection:** No connection limit imposed by Supavisor free tier
- **Cost:** Fly.io shared-cpu-1x 256MB ≈ $2/month (vs Render Starter $7/month)

**Limitations:**
- Direct connection host is IPv6-only — local testing requires IPv6 DNS/connectivity (most home networks lack this)
- Fail2ban bans IPs after repeated authentication failures (clears in 30 minutes or via Supabase CLI)
- Must use correct `User Id=postgres` (not `postgres.<project-ref>`) for direct connections

**Credentials Critical Note:**
Connecting to the direct host with wrong User Id (e.g., `postgres.cfuccajsckqzecbfyqrv`) will fail with "password authentication failed" and trigger Fail2ban after 2 failures, blocking the IP for 30 minutes. Always verify credentials locally against Supavisor first if troubleshooting:
```
psql "postgresql://postgres.<project-ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
```

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

## Migration to Fly.io with Direct Connections (2026-02-21)

### Issue: Credentials Confusion

Initial deployment to Fly.io used wrong User Id for direct connections:
- **Attempted:** `User Id=postgres.cfuccajsckqzecbfyqrv` (Supavisor format)
- **Correct:** `User Id=postgres` (Direct connection format)

This caused repeated "password authentication failed" errors in Supabase logs and triggered Fail2ban, resulting in `SocketException: Connection refused` at the TCP level.

### Root Cause

Supavisor and direct connections use different authentication schemes:
- **Supavisor** translates the `postgres.<project-ref>` user to the underlying `postgres` user
- **Direct connections** require `postgres` user directly — the project ref suffix doesn't exist as a direct user

### Resolution

1. Fixed connection string in Fly.io secrets to use `User Id=postgres`
2. Waited for Fail2ban 30-minute ban to expire
3. Verified connection works with correct credentials

### Testing Direct Connections

**IPv6 DNS limitation:** The direct connection host `db.*.supabase.co` only has IPv6 DNS records (AAAA, no A). Most local machines don't have IPv6 connectivity, causing `nodename nor servname provided` errors.

**Workaround:** Test password against Supavisor (IPv4, accessible locally) first:
```bash
psql "postgresql://postgres.<project-ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
```

If that connects, the password is correct. Test direct connection from Fly.io:
```bash
fly ssh console -a f1fantasyapp
psql "postgresql://postgres:<password>@db.cfuccajsckqzecbfyqrv.supabase.co:5432/postgres?sslmode=require"
```
