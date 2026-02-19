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

## Alternatives Considered

### Session mode with default pool size (Attempt 1)
Session mode on port 5432, but with Npgsql's default `Maximum Pool Size=100`. Supavisor rejected connections with `MaxClientsInSessionMode` errors because 100 far exceeds the ~15-20 backend connection limit per user/db/mode.

### Transaction mode (Attempt 2)
Transaction mode on port 6543 returned the physical Postgres connection to Supavisor's pool after every query. Each subsequent EF Core query re-established a physical connection through Supavisor, adding ~7.5 seconds per query. Intermittent TCP timeouts to Supavisor compounded the problem. Transaction mode is designed for serverless workloads, not persistent API servers.

### Transaction mode with multiplexing (Attempt 3)
Adding `Multiplexing=true` to the connection string kept existing Npgsql connections alive (0ms reopens), but new TCP connections to Supavisor still intermittently timed out. Npgsql's multiplexing is also experimental and not validated with Supavisor.
