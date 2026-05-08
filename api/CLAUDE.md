# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

.NET 10 ASP.NET Core Minimal API for F1 Fantasy Sports with Supabase authentication and PostgreSQL database.

## Essential Commands

```bash
# Build
dotnet build F1CompanionApi/F1CompanionApi.csproj

# Run API
dotnet run --project F1CompanionApi/F1CompanionApi.csproj
dotnet watch run --project F1CompanionApi/F1CompanionApi.csproj  # hot reload

# Run tests
dotnet test F1CompanionApi.UnitTests/F1CompanionApi.UnitTests.csproj

# Run single test (filter by name)
dotnet test --filter "FullyQualifiedName~TestMethodName"

# Code coverage
./run-coverage.sh
./run-coverage.sh --open  # opens report in browser

# Formatting (CSharpier + dotnet format, enforced by pre-commit hook)
dotnet csharpier format .
dotnet format style --exclude **/Migrations/**
dotnet format analyzers --exclude **/Migrations/**

# Database migrations
dotnet ef migrations add MigrationName --project F1CompanionApi
dotnet ef database update --project F1CompanionApi
dotnet ef migrations remove --project F1CompanionApi
```

## Architecture

### Layer Structure

- **Api/Endpoints/**: Minimal API route definitions - static classes with `Map{Feature}Endpoints` extension methods chained in `Endpoints.MapEndpoints()`
- **Api/Mappers/**: Entity-to-DTO extension methods (`ToResponseModel()`)
- **Api/Models/**: Request/response DTOs
- **Domain/Services/**: Business logic - interface-based services registered in `ServiceExtensions.cs`
- **Domain/Exceptions/**: Custom exceptions with `GlobalExceptionHandler`
- **Data/**: `ApplicationDbContext` and entity models
- **Data/Entities/**: All entities inherit from `BaseEntity` (audit fields) or `UserOwnedEntity`
- **Extensions/**: Service registration (`ServiceExtensions.cs`)

### Key Patterns

**Endpoints**: Private static async methods returning `IResult`, configured with `.RequireAuthorization()`, `.WithName()`, `.WithDescription()`

**Services**: Constructor-injected `ApplicationDbContext`, async operations, use `.Include()` for navigation properties, return response DTOs via mapper extension methods

**Entities**: `BaseEntity` provides `CreatedBy/At`, `UpdatedBy/At`, `DeletedBy/At` audit fields with `UserProfile` navigation properties

## Unit Tests

Scope: pure logic and service-level computation (e.g., scoring math). Cross-boundary concerns — routing, auth, DB constraints, EF query behavior — belong in integration tests (see below), not here.

- **Framework**: xUnit + Moq
- **Naming**: `{MethodName}_{Scenario}_{ExpectedOutcome}`
- **File structure**: Mirrors source — `F1CompanionApi.UnitTests/Services/`, `F1CompanionApi.UnitTests/Api/Endpoints/`
- **Legacy patterns in this project**: some existing tests use EF InMemory for service setup and reflection to invoke private endpoint methods. Don't extend these patterns for new tests — anything that needs a DB or exercises the HTTP pipeline belongs in integration tests.

## Integration Tests

Full API boot via `WebApplicationFactory<Program>` against a Testcontainers Postgres. See `F1CompanionApi.IntegrationTests/README.md` for fixture lifecycle, authentication helpers, and when to choose this layer over unit tests.

- **Location**: `F1CompanionApi.IntegrationTests/`
- **Run**: `npm run api:test:integration` from repo root (Docker Desktop required)
- **Base class**: inherit `IntegrationTestBase` — resets the DB per test and exposes `Factory` + `WithDbAsync` helpers
- **Auth**: prefer `factory.CreateAuthenticatedAsync()` over crafting `X-Test-User-Id` headers by hand

## E2E Tests

Playwright suite at `../e2e/` drives a prod-like web + API build against a dedicated local Supabase stack (`e2e/supabase/`, ports +100 from the dev stack). Owns cross-system failure modes only — CORS, cookie/auth flow, Supabase Storage wiring, critical user journeys. Validation matrices and branch logic belong in unit/integration, not here. See `../e2e/README.md` for the run prerequisite (`cd e2e/supabase && supabase start`), selector discipline, and per-test reset behavior.

## Configuration

Required settings in `appsettings.json` or user secrets:
- `ConnectionStrings:DefaultConnection` - PostgreSQL connection string
- `Supabase:JwtSecret` - JWT validation secret
- `Sentry:Dsn` - Error tracking DSN (optional)
- `CorsOrigins` - Array of allowed origins

## Logging

Use `ILogger<T>` with structured logging (named placeholders, not string interpolation):
```csharp
_logger.LogInformation("Creating league {LeagueName} for user {UserId}", name, userId);
```

## Observability

**ConnectionDiagnosticsInterceptor** (`Data/ConnectionDiagnosticsInterceptor.cs`) — logs a
warning for any DB connection that takes >1s to open. Look for `Slow DB connection` entries in
Fly logs (`fly logs -a f1fantasyapp`) when diagnosing connectivity issues. The log includes a
connection GUID, host:port, and duration in ms.

**DbContext is Scoped** — all services in a single HTTP request share the same `ApplicationDbContext`
instance.

**Production connection string** is in the `ConnectionStrings__DefaultConnection` Fly secret
(not in source). Check `ServiceExtensions.cs:AddDbContext` for how it's consumed.

## Common Tasks

### Adding a New Endpoint

1. Create `{Feature}Endpoints.cs` in `Api/Endpoints/` with a static `Map{Feature}Endpoints` extension method
2. Define private static async methods returning `IResult`, chain `.RequireAuthorization()`, `.WithName()`, `.WithDescription()`
3. Register in `Endpoints.MapEndpoints()` by chaining `.Map{Feature}Endpoints()`
4. Add request/response DTOs in `Api/Models/`
5. Add mapper extension method in `Api/Mappers/`

### Adding a New Entity

1. Create entity class in `Data/Entities/` inheriting from `BaseEntity` (or `UserOwnedEntity` if user-owned)
2. Add `DbSet<Entity>` to `ApplicationDbContext`
3. Run `dotnet ef migrations add MigrationName --project F1CompanionApi`
4. Run `dotnet ef database update --project F1CompanionApi`

RLS is auto-enabled on new public tables via the `auto_enable_rls_public` Supabase event trigger; no manual `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is needed in the EF migration. No policies are defined — the .NET API connects with a privileged role that bypasses RLS, so RLS exists purely as defense-in-depth against direct queries to the Supabase REST surface (anon/authenticated roles).

### Adding a New Service

1. Create interface `I{Feature}Service` and implementation in `Domain/Services/`
2. Register as scoped in `ServiceExtensions.cs:AddServices`: `services.AddScoped<IFeatureService, FeatureService>()`

### Adding a New Exception

- Use standard HTTP status codes only — avoid WebDAV-specific codes (e.g. use 409 Conflict, not 423 Locked)
- The class `<summary>` should explain both what triggers the exception and why it's considered exceptional (what it implies about the caller). See `SlotOccupiedException` as the reference example.
