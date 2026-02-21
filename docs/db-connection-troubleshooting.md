# Database Connection Troubleshooting

A walkthrough of debugging production database connection failures between Render (free tier) and Supabase (free tier), and how the issue was ultimately resolved.

## Problem Statement

After deploying the F1 Fantasy API to Render's free tier, database connections were failing intermittently or completely. The API could not reliably reach the Supabase-hosted PostgreSQL database, resulting in request failures on every endpoint that touches the database.

The initial page load fires two concurrent requests (`GET /api/me/profile` + `GET /api/me/team/`), so connection issues were immediately visible to users.

## Investigation

### Root Cause: IPv6 Incompatibility

The core issue was a platform mismatch:

- **Supabase** switched direct database connections (`db.*.supabase.co`) to **IPv6-only** in February 2024. IPv4 access requires a paid add-on ($4/month).
- **Render's free tier** does **not support IPv6 outbound** connections.

This meant the API couldn't reach Supabase's direct connection host at all. The only path was through **Supavisor** (`aws-1-us-east-2.pooler.supabase.com`), Supabase's connection pooler, which still accepts IPv4.

### Why This Was Hard to Diagnose

- Supabase has **zero .NET/C#/Npgsql documentation** — all connection guides target JS/Python
- The few .NET + Supabase tutorials assume direct connections (which don't work from Render)
- Npgsql's default `Maximum Pool Size=100` silently exceeds Supavisor free tier limits
- Error messages from Supavisor were not always self-explanatory

## Attempts and Failures

### Attempt 1: Session Mode with Default Pool Size

**Configuration:** Session mode (port 5432 via Supavisor pooler), default Npgsql settings.

**Error:** `MaxClientsInSessionMode` — pool exhaustion.

**Why it failed:** Npgsql defaults to `Maximum Pool Size=100`. In session mode, each Npgsql pooled connection maps 1:1 to a Supavisor backend connection. Supavisor's free tier allows only ~15-20 backend connections per user/db/mode. The Npgsql pool tried to open far more connections than Supavisor would allow.

### Attempt 2: Transaction Mode

**Configuration:** Transaction mode (port 6543 via Supavisor pooler).

**Error:** Per-query physical reconnection (~7.5 seconds each), intermittent TCP timeouts.

**Why it failed:** Transaction mode returns the physical Postgres connection to Supavisor's pool after every implicit transaction (i.e., every EF Core query). For a persistent API server, this means every query in a request pays a full reconnection cost through Supavisor. This is by design — transaction mode is built for serverless workloads with short-lived connections, not persistent servers that issue multiple queries per request.

The `ConnectionDiagnosticsInterceptor` logs confirmed this: repeated `Slow DB connection` entries with the same connection GUID showed the same logical connection re-establishing physical connections on every query.

### Attempt 3: Transaction Mode with Multiplexing

**Configuration:** Transaction mode (port 6543) + `Multiplexing=true` in the connection string.

**Error:** New TCP connections to Supavisor still intermittently timed out.

**Why it failed:** Multiplexing kept *existing* Npgsql connections alive (0ms reopens for reused connections), but establishing *new* TCP connections to Supavisor still hit intermittent timeouts. Additionally, Npgsql's multiplexing feature is experimental and has not been validated with Supavisor.

## Solution

### Configuration

**Session mode (port 5432)** via Supavisor with `Maximum Pool Size=10`:

```
User Id=postgres.<project-ref>;Password=<pw>;Server=aws-1-us-east-2.pooler.supabase.com;Port=5432;Database=postgres;SSL Mode=Require;Maximum Pool Size=10
```

Combined with EF Core retry-on-failure in `api/F1CompanionApi/Extensions/ServiceExtensions.cs`:

```csharp
options.UseNpgsql(connectionString, npgsqlOptions =>
    npgsqlOptions.EnableRetryOnFailure(
        maxRetryCount: 3,
        maxRetryDelay: TimeSpan.FromSeconds(5),
        errorCodesToAdd: null
    ))
```

### Why It Works

- **Session mode** keeps the backend Postgres connection tied to the client connection for its lifetime — no per-query reconnection overhead
- **Pool size of 10** stays safely within Supavisor's ~15-20 backend connection limit per user/db/mode
- **EF Core retry** handles transient failures during cold starts or brief Supavisor hiccups
- Both Render and Supabase are in the same AWS region (Ohio), so latency through the pooler is minimal

## Post-Deployment Issues: TCP Timeouts (2026-02-16 to 2026-02-21)

### Problem

Starting Feb 16, TCP-level connection failures to Supavisor emerged. Errors manifested as:
- TCP timeouts at exactly ~15,000ms (Npgsql `Timeout=15`) when opening new connections
- `RetryLimitExceededException` after EF Core's 3 retries (total wait: ~45 seconds)
- Affected all DB-touching endpoints: `/api/me/profile` (32%), `/api/me/team/` (59%), `/api/races/` (4%), and others
- 686 errors in 14 days (Feb 7-21)
- Error rate accelerated: 1 error (Feb 7-10) → 270 errors (Feb 14-17) → 415 errors (Feb 18-21)
- Errors NOT confined to cold starts — many instances failed for 10+ minutes continuously while running

### Root Cause Investigation

**Data sources examined:**
1. **Sentry:** 100 error events — all `TimeoutException` at exactly ~15,000ms. Failures to two Supavisor IPs: `3.131.201.192:5432` and `3.148.140.216:5432`
2. **Render logs:** Service restarted 16+ times in 3 days on free tier. Errors clustered immediately after startups (within 30 seconds to 2 minutes)
3. **Supabase Postgres logs:** Zero errors, zero connection rejections. Healthy `postgres_exporter` and dashboard connections only.

**What was ruled out:**
- Stale connections — adding `Keepalive=30;Connection Idle Lifetime=120;Connection Lifetime=300` restarted the service (fresh connections), errors persisted immediately
- Pool exhaustion — only ~1 active user, 2 concurrent requests max
- Supabase-side issues — Postgres logs showed zero connection problems
- Cross-region latency — both services in AWS Ohio

**Root Cause:** Render free-tier networking drops TCP packets to Supavisor. Evidence:
1. **Bimodal latency distribution:** Connections either succeed in <500ms (88.5%) or fail with timeout at ~15,000ms (8.6%), NOT a continuum of slow connections
2. **Every error times out at exactly ~15,000ms** — signature of dropped SYN packets (TCP connection never establishes) rather than slow handshakes
3. **Failures happen at every lifecycle stage**, not just cold start:
   - Instance `bmc99`: Failed 32 seconds after startup (pool empty, no eviction possible)
   - Instance `qr2v2`: Failed continuously for 10+ minutes even after successful startup connections
   - Instance `vj2r6`: Failed 7 minutes after successful startup (but this could be pool eviction cascade)
4. **Supabase Postgres logs showed zero errors** — connections never reach the database, they die at the Render→Supavisor network boundary
5. **Both Supavisor IPs failed equally** (54% vs 46%) — not a single-node problem

**Contributing factors that increased error rate in mid-February:**
1. **More deployments** (9 in 1 week) = more cold starts
2. **Increased traffic** (UX redesign Feb 16 made app more usable)
3. **Retry amplification** (3 retries × dropped packets = 3× error count)
4. **More DB-touching endpoints** (Race/Season features deployed Feb 5)

**Important:** The underlying packet-drop problem is infrastructure-level, not something Npgsql settings can fix. A longer timeout doesn't help if packets are dropped.

### Mitigation (Incomplete)

Two code changes in the API (in working tree, not yet deployed):

**1. Increase Npgsql `Timeout` to 30s** (`ServiceExtensions.cs`):
```csharp
private static string BuildConnectionString(IConfiguration configuration)
{
    var raw = configuration.GetConnectionString("DefaultConnection");
    var builder = new NpgsqlConnectionStringBuilder(raw)
    {
        Timeout = 30,
    };
    return builder.ConnectionString;
}
```

Helps the cold-start case by allowing more time for TCP handshake to complete, but **does not fix dropped packets** — a longer timeout just means waiting longer for the same timeout.

**2. DB connection warmup at startup** (`Program.cs`):
```csharp
await WarmUpDatabaseAsync(app);

static async Task WarmUpDatabaseAsync(WebApplication app)
{
    var logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("DbWarmup");
    try
    {
        using var scope = app.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await dbContext.Database.CanConnectAsync();
        logger.LogInformation("Database connection warm-up succeeded");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Database connection warm-up failed — app will start anyway");
    }
}
```

Absorbs startup connection latency before first user request, but doesn't help mid-lifecycle failures after pool eviction or connection reuse.

**Why this mitigation is insufficient:**
- Timeline analysis shows failures happen on first connection attempts (when pool is empty), not after eviction
- Instance `qr2v2` failed for 10+ minutes continuously — warmup was only attempted once at startup
- The underlying Render→Supavisor packet-drop issue remains unaddressed

### Possible Additional Mitigation

Consider adding `Minimum Pool Size=1` to the connection string:
```
Maximum Pool Size=10;Minimum Pool Size=1;...
```

This keeps at least one TCP connection alive to Supavisor at all times. The `Keepalive=30` pings can then serve their purpose (detecting broken connections). This reduces (but doesn't eliminate) the probability of all connections being evicted, which would force a new TCP connection that may hit the unreliable Render→Supavisor path.

### Verification (After Deployment)

Monitor after deployment:
- Sentry error rates may drop slightly for cold-start cases, but mid-lifecycle failures may persist
- Render logs should show `Database connection warm-up succeeded` on each startup
- `ConnectionDiagnosticsInterceptor` should show connection open times; if many exceed 10s, Supavisor path is degraded
- Watch for patterns: do errors cluster at specific times? Correlate with Render deployment timestamps and Supabase traffic patterns

### The Real Fix

These mitigations treat symptoms, not causes. The real solution requires moving off free tiers:
1. **Supabase:** Upgrade to Pro ($25/month) + IPv4 add-on ($4/month) for direct connections, bypassing Supavisor
2. **Render:** Upgrade to paid tier for dedicated compute and reliable outbound networking, or move to a provider with IPv6 support
3. **Architectural:** Switch to Supabase REST API (HTTP) instead of raw TCP — HTTP traffic routes through Supabase API gateway (more reliable than direct pooler)

## Diagnostics

### ConnectionDiagnosticsInterceptor

Added in `api/F1CompanionApi/Data/ConnectionDiagnosticsInterceptor.cs`, this EF Core `DbConnectionInterceptor` logs every connection open and failure:

- **Normal connections:** `DB connection {ConnectionId} to {Host}:{Port} opened in {DurationMs}ms` (Info level)
- **Slow connections (>1s):** `Slow DB connection {ConnectionId} to {Host}:{Port} opened in {DurationMs}ms` (Warning level)
- **Failed connections:** Full error with exception, connection ID, host:port, duration, and connection state (Error level)

**What to look for in Render logs:**
- `Slow DB connection` warnings — indicates Supavisor or network latency issues
- Repeated slow connections with the **same connection GUID** — suggests transaction mode re-establishment overhead (shouldn't happen with session mode)
- `MaxClientsInSessionMode` errors — pool size exceeds Supavisor limits
- Connection failures with TCP timeout — potential Supavisor or network issues

### Viewing Logs

Use the Render MCP server to check production logs:
- `mcp__render__list_logs` with service ID `srv-d2pqsbbe5dus73bcttfg`

## Fly.io Migration & Direct Connection Credentials (2026-02-21)

### Problem: Connection Refused After Fly.io Migration

After migrating from Render to Fly.io, initial deployment showed `SocketException: Connection refused` when connecting to Supabase's direct database host (`db.cfuccajsckqzecbfyqrv.supabase.co`).

### Root Cause: Wrong User Id for Direct Connections

**Supavisor connection string (IPv4 pooler):**
```
User Id=postgres.cfuccajsckqzecbfyqrv;Password=<pw>;Server=aws-1-us-east-2.pooler.supabase.com;Port=5432;Database=postgres;SSL Mode=Require
```

**Direct connection string (IPv6, no pooler):**
```
User Id=postgres;Password=<pw>;Server=db.cfuccajsckqzecbfyqrv.supabase.co;Port=5432;Database=postgres;SSL Mode=Require
```

The key difference: **Direct connections use `User Id=postgres` (no project ref suffix).** Supavisor requires the project ref suffix (`postgres.<project-ref>`) because it translates that user to the underlying `postgres` user. Direct connections go straight to Postgres and require the actual user name.

Using `postgres.cfuccajsckqzecbfyqrv` with a direct connection causes "password authentication failed" errors, which trigger Supabase's Fail2ban after 2 failures, banning the IP for 30 minutes.

### Debugging Direct Connection Credentials

**IPv6 DNS limitation:** The direct host `db.*.supabase.co` only has IPv6 AAAA records. Most local machines lack IPv6 connectivity and will get `nodename nor servname provided, or not known` errors.

**Safe testing approach:**

1. **Verify password against Supavisor first** (IPv4, accessible locally):
```bash
psql "postgresql://postgres.cfuccajsckqzecbfyqrv:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
```
If this connects, the password is correct.

2. **Test direct connection from Fly.io** (where IPv6 works):
```bash
fly ssh console -a f1fantasyapp
psql "postgresql://postgres:<password>@db.cfuccajsckqzecbfyqrv.supabase.co:5432/postgres?sslmode=require"
```

3. **If still failing:** Check Supabase Postgres logs for `FATAL: password authentication failed for user "postgres"` entries. If multiple auth failures appear, Fail2ban is active — wait 30 minutes or unban via Supabase CLI:
```bash
supabase projects unban --project-ref cfuccajsckqzecbfyqrv
```

### Why Fly.io + Direct Connections Work

- **Fly.io has reliable IPv6 outbound** to AWS/Supabase (unlike Render free tier which drops packets)
- **Direct connection bypasses Supavisor** — no intermediary, lower latency
- **Standard Postgres authentication** — use standard User Id format
- **Cost:** ~$2/month (shared-cpu-1x 256MB, always-on) vs Render Starter $7/month

## Reference

### Supabase Free Tier Limits

| Limit | Value |
|---|---|
| Max database connections | 60 |
| Max pooler client connections | 200 |
| Backend connections per user/db/mode | ~15-20 |

### Key Connection String Parameters

| Parameter | Value | Set In | Why |
|---|---|---|---|
| `Server` | `aws-1-us-east-2.pooler.supabase.com` | Env var | Supavisor pooler (IPv4 accessible) |
| `Port` | `5432` | Env var | Session mode |
| `SSL Mode` | `Require` | Env var | Required by Supabase |
| `Maximum Pool Size` | `10` | Env var | Stay within Supavisor backend limit |
| `User Id` | `postgres.<project-ref>` | Env var | Supavisor requires project ref suffix |
| `Timeout` | `30` | Code | Override Npgsql default (15s) — Supavisor handshakes can exceed 15s |
| `Keepalive` | `30` | Env var | TCP keep-alive probes detect stale connections (sec) |
| `Connection Idle Lifetime` | `120` | Env var | Discard pooled connections idle for 120+ sec |
| `Connection Lifetime` | `300` | Env var | Rotate connections older than 5 minutes |

### Key Files

| File | Purpose |
|---|---|
| `api/F1CompanionApi/Extensions/ServiceExtensions.cs` | DB connection configuration and EF Core retry setup |
| `api/F1CompanionApi/Data/ConnectionDiagnosticsInterceptor.cs` | Connection logging and slow-query detection |

### Relevant Links

- [Supabase Connection Pooler docs](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase IPv6 announcement](https://supabase.com/docs/guides/platform/ipv6)
- [Npgsql connection string parameters](https://www.npgsql.org/doc/connection-string-parameters.html)
- [Render IPv6 support discussion](https://feedback.render.com/features/p/ipv6-support)
