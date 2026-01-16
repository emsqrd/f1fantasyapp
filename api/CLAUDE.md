# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

.NET 9 ASP.NET Core Minimal API for F1 Fantasy Sports with Supabase authentication and PostgreSQL database.

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

**Endpoints**: Private static async methods returning `IResult`, configured with `.RequireAuthorization()`, `.WithName()`, `.WithOpenApi()`, `.WithDescription()`

**Services**: Constructor-injected `ApplicationDbContext`, async operations, use `.Include()` for navigation properties, return response DTOs via mapper extension methods

**Entities**: `BaseEntity` provides `CreatedBy/At`, `UpdatedBy/At`, `DeletedBy/At` audit fields with `UserProfile` navigation properties

## Testing

- **Framework**: xUnit + Moq
- **Service tests**: In-memory database with unique GUID names for isolation
- **Endpoint tests**: Reflection to invoke private static methods, mock services
- **Naming**: `{MethodName}_{Scenario}_{ExpectedOutcome}`
- **File structure**: Mirrors source - `F1CompanionApi.UnitTests/Services/`, `F1CompanionApi.UnitTests/Api/Endpoints/`

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
