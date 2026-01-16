# F1 Companion API

.NET 9 ASP.NET Core Minimal API for F1 Fantasy Sports application.

## Features

- **Authentication**: JWT Bearer authentication with Supabase
- **Database**: PostgreSQL with Entity Framework Core 9
- **Error Tracking**: Sentry.io integration with structured logging
- **Performance Monitoring**: Automatic transaction tracking
- **API Documentation**: OpenAPI/Swagger with Scalar UI

## Quick Start

### Prerequisites

- .NET 9 SDK
- PostgreSQL database
- Sentry account (for error tracking)

### Setup

1. **Clone and restore packages**

   ```bash
   dotnet restore
   ```

2. **Configure settings**

   Update `appsettings.json` or use user secrets:

   ```bash
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "your-connection-string"
   dotnet user-secrets set "Supabase:JwtSecret" "your-jwt-secret"
   dotnet user-secrets set "Sentry:Dsn" "your-sentry-dsn"
   ```

3. **Run migrations**

   ```bash
   dotnet ef database update --project F1CompanionApi
   ```

4. **Run the API**

   ```bash
   dotnet run --project F1CompanionApi
   ```

   Or with hot reload:

   ```bash
   dotnet watch run --project F1CompanionApi
   ```

The API will be available at `http://localhost:5000` (or the configured port).

## Documentation

- **[AI Coding Guidelines](.github/copilot-instructions.md)** - Comprehensive development guidelines
- **[Sentry Integration](.github/instructions/sentry.md)** - Error tracking and logging best practices
- **[Sentry Quick Start](docs/sentry-setup.md)** - Quick setup guide for Sentry

## Testing

```bash
# Run all tests
dotnet test

# Run with coverage
./run-coverage.sh

# Run with coverage and open report
./run-coverage.sh --open
```

## Architecture

- **Minimal API Endpoints** (`Api/Endpoints/`) - Route definitions and HTTP handlers
- **Service Layer** (`Domain/Services/`) - Business logic with interface-based DI
- **Data Layer** (`Data/`) - EF Core context and entity models
- **Extensions** (`Extensions/`) - Service registration and configuration

## Key Technologies

- .NET 9 with C# 13
- ASP.NET Core Minimal APIs
- Entity Framework Core 9 + PostgreSQL
- Supabase (Authentication)
- Sentry (Error Tracking & Logging)
- xUnit + Moq (Testing)

## Development

### Build

```bash
dotnet build F1CompanionApi
```

### Watch Mode

```bash
dotnet watch run --project F1CompanionApi
```

### Database Migrations

```bash
# Create a new migration
dotnet ef migrations add MigrationName --project F1CompanionApi

# Apply migrations
dotnet ef database update --project F1CompanionApi

# Revert migration
dotnet ef migrations remove --project F1CompanionApi
```

## Contributing

Please follow the guidelines in `.github/copilot-instructions.md` for:

- Code architecture patterns
- Testing strategies
- Error handling and logging
- Entity Framework conventions
