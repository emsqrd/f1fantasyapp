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

## Reference

### Supabase Free Tier Limits

| Limit | Value |
|---|---|
| Max database connections | 60 |
| Max pooler client connections | 200 |
| Backend connections per user/db/mode | ~15-20 |

### Key Connection String Parameters

| Parameter | Value | Why |
|---|---|---|
| `Server` | `aws-1-us-east-2.pooler.supabase.com` | Supavisor pooler (IPv4 accessible) |
| `Port` | `5432` | Session mode |
| `SSL Mode` | `Require` | Required by Supabase |
| `Maximum Pool Size` | `10` | Stay within Supavisor backend limit |
| `User Id` | `postgres.<project-ref>` | Supavisor requires project ref suffix |

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
