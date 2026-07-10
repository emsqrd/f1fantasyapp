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
5. Add mapper extension method in `Api/Mappers/` (see "Mapper file organization" below)

**Read-endpoint 404 pattern.** When an unguarded read targets a single resource that may not exist, the service returns a nullable response (`Task<XxxResponse?>`) and the handler maps `null → 404`: `LogWarning(...)` then `Results.Problem(detail: "...", statusCode: StatusCodes.Status404NotFound)`. Reference: `SeasonEndpoints.GetCurrentSeasonAsync`, `DriverEndpoints`, `ConstructorEndpoints`.

**Access-controlled reads guard first.** When the caller must be authorized to see the resource, a guard call precedes the read and throws for both absence (404) and denial (403); a nullable return cannot express the second. The read that follows is total, so the handler does no null check. Reference: `LeagueEndpoints.GetLeagueByIdAsync`.

**Required-resource guards in services.** When a service needs a resource that must exist for the work to be meaningful (e.g., the current season for a season-scoped read), guard at the service boundary with `?? throw new InvalidOperationException("...")`. Surfaces as a 500, distinct from "the resource the caller asked for doesn't exist" (404). Reference: `LeagueStandingsService.cs:147`, `LineupService.cs:39`, `ScoringService.cs:218`.

### Mapper file organization

- **One file per source entity.** Named after the primary DTO it produces, lives in `Api/Mappers/`. Multiple methods in the same file when the same source maps to base + richer variants — `Team → TeamResponse` and `Team → TeamDetailsResponse` both live in `TeamResponseMapper.cs`.
- **Container/child splits across files.** When a DTO contains a nested child DTO, the child gets its own mapper file. `TeamDetailsResponse` contains `TeamDriverResponse` and `TeamConstructorResponse`, so there are three mapper files (`TeamResponseMapper`, `TeamDriverResponseMapper`, `TeamConstructorResponseMapper`); the parent mapper calls the children via their extension methods.
- **Mappers stay decision-free.** Selection logic (`OrderByDescending(...).FirstOrDefault()`) belongs in the service; pass the already-selected value into the mapper. Aggregation (`Sum`, ordering for output) inside the mapper is fine. Reference: `TeamSummaryResponseMapper.ToResponseModel` accepts a pre-selected `latest`.

### Adding a New Entity

1. Create entity class in `Data/Entities/` inheriting from `BaseEntity` (or `UserOwnedEntity` if user-owned)
2. Add `DbSet<Entity>` to `ApplicationDbContext`
3. Run `dotnet ef migrations add MigrationName --project F1CompanionApi`
4. Run `dotnet ef database update --project F1CompanionApi`

RLS is auto-enabled on new public tables via the `auto_enable_rls_public` Supabase event trigger; no manual `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is needed in the EF migration. No policies are defined — the .NET API connects with a privileged role that bypasses RLS, so RLS exists purely as defense-in-depth against direct queries to the Supabase REST surface (anon/authenticated roles).

### Adding a New Service

1. Create interface `I{Feature}Service` and implementation in `Domain/Services/`
2. Register as scoped in `ServiceExtensions.cs:AddServices`: `services.AddScoped<IFeatureService, FeatureService>()`

**Service method naming for user-scoped reads.** When a method takes `int userId` and returns something belonging to that user, use the `GetXForUserAsync(int userId)` shape (e.g., `GetStandingsForUserAsync`, `GetLeaguesForUserAsync`) rather than `GetUserXAsync`. The `User`-prefixed form is grammatically ambiguous — `GetUserStandingsAsync` reads either as "get [user-standings]" (some concept) or "get [the user's] standings." The `ForUser` form removes that ambiguity. The codebase has both forms historically (`TeamService.GetUserTeamAsync` uses the prefix); don't retroactively rename existing methods unless asked, but prefer `ForUser` for new ones.

### Adding a New Exception

- **Create a custom exception when the failure needs its own ProblemDetails response:** a distinct status code, title, and detail. `GlobalExceptionHandler.cs` maps each type to exactly that triple. If `null → 404` from the endpoint already says everything, don't add a type.
- **Custom exceptions are not restricted to write paths.** Access guards throw them on reads, because a nullable return cannot express 403.
- **An exception's name does not predict its status code**, and a `*NotFoundException` does not necessarily map to 404. Read the switch in `GlobalExceptionHandler.cs` before adding or reusing a type.
- Use standard HTTP status codes only — avoid WebDAV-specific codes (e.g. use 409 Conflict, not 423 Locked)
- The class `<summary>` should explain both what triggers the exception and why it's considered exceptional (what it implies about the caller). See `SlotOccupiedException` as the reference example.
