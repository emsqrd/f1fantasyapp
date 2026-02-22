# ADR 001: Supabase Connection Strategy

**Date:** 2026-02-18 (updated 2026-02-21)
**Status:** Accepted

## Context

The F1 Fantasy API connects to a Supabase-hosted PostgreSQL database. Two platform constraints shaped this decision:

1. **Supabase switched direct database connections to IPv6-only** (Feb 2024). IPv4 access requires a paid add-on ($4/month).
2. **Render's free tier** (our original host) **does not support IPv6 outbound**, and intermittently drops TCP packets to Supavisor, Supabase's connection pooler.

This meant the API on Render could only reach Supabase through Supavisor (`aws-1-us-east-2.pooler.supabase.com`), which still accepts IPv4. However, Render's packet loss caused escalating connection failures — 686 errors over 14 days in February 2026, with some instances failing continuously for 10+ minutes. The root cause was multi-layered: Render dropping outbound TCP packets, Supavisor closing idle connections, and Npgsql's default pool settings allowing all connections to drain. No amount of connection string tuning could fix dropped packets.

## Decision

Migrate to **Fly.io** and use **direct Supabase connections** (IPv6), bypassing Supavisor entirely.

Connection string format:
```
User Id=postgres;Password=<pw>;Server=db.cfuccajsckqzecbfyqrv.supabase.co;Port=5432;Database=postgres;SSL Mode=Require
```

EF Core retry configuration (in `ServiceExtensions.cs`):
```csharp
options.UseNpgsql(connectionString, npgsqlOptions =>
    npgsqlOptions.EnableRetryOnFailure(
        maxRetryCount: 3,
        maxRetryDelay: TimeSpan.FromSeconds(5),
        errorCodesToAdd: null
    ))
```

## Consequences

**Benefits:**
- No packet loss — Fly.io has reliable IPv6 outbound to AWS/Supabase
- No pooler overhead — direct connection bypasses Supavisor, lower latency
- No Supavisor free-tier connection limits
- Cost: ~$2/month (shared-cpu-1x 256MB) vs Render Starter $7/month

**Limitations:**
- Direct connection host is IPv6-only — local `psql` testing won't work on most home networks
- Must use `User Id=postgres` (not `postgres.<project-ref>`) for direct connections

**Credential gotcha:** Supavisor and direct connections use different User Id formats:
- **Supavisor:** `postgres.<project-ref>` (pooler translates this to the `postgres` user)
- **Direct:** `postgres` (the actual Postgres user)

Using the Supavisor format against the direct host causes "password authentication failed" and triggers Supabase's Fail2ban after 2 failures, banning the IP for 30 minutes. To unban: `supabase projects unban --project-ref cfuccajsckqzecbfyqrv`

**Testing direct connections:** Since the direct host is IPv6-only, verify the password against Supavisor (IPv4) first, then test from Fly.io:
```bash
# 1. Verify password locally via Supavisor
psql "postgresql://postgres.<project-ref>:<password>@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"

# 2. Test direct connection from Fly.io
fly ssh console -a f1fantasyapp
psql "postgresql://postgres:<password>@db.cfuccajsckqzecbfyqrv.supabase.co:5432/postgres?sslmode=require"
```

## Alternatives Considered

All alternatives used Supavisor on Render and were rejected due to reliability issues:

### Session mode with default pool size
Npgsql defaults to `Maximum Pool Size=100`. Supavisor's free tier allows ~15-20 backend connections per user/db/mode. Result: `MaxClientsInSessionMode` errors.

### Session mode with reduced pool size
`Maximum Pool Size=10` on port 5432. Stayed within Supavisor limits and worked initially, but Render's TCP packet loss caused escalating connection failures that no pool tuning could fix.

### Transaction mode
Port 6543 returns the physical Postgres connection to Supavisor's pool after every query. Each EF Core query re-established a connection through Supavisor (~7.5s per query). Designed for serverless workloads, not persistent API servers.

### Transaction mode with multiplexing
Adding `Multiplexing=true` kept existing connections alive, but new TCP connections to Supavisor still timed out intermittently. Npgsql multiplexing is also experimental and unvalidated with Supavisor.
