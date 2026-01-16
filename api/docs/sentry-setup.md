# Sentry Setup Quick Start

## 1. Get Your Sentry DSN

1. Go to [sentry.io](https://sentry.io) and create an account or sign in
2. Create a new project and select **ASP.NET Core** as the platform
3. Copy your DSN (Data Source Name) - it looks like: `https://examplePublicKey@o0.ingest.sentry.io/0`

## 2. Configure Your Application

### Update appsettings.json

Add your DSN to the Sentry configuration:

```json
{
  "Sentry": {
    "Dsn": "https://your-dsn@sentry.io/project-id",
    "Environment": "Development"
  }
}
```

### For Production - Use User Secrets or Environment Variables

**Never commit your DSN to source control for production!**

#### Option 1: User Secrets (Development)

```bash
cd F1CompanionApi
dotnet user-secrets set "Sentry:Dsn" "https://your-dsn@sentry.io/project-id"
```

#### Option 2: Environment Variables (Production)

```bash
export Sentry__Dsn="https://your-dsn@sentry.io/project-id"
export Sentry__Environment="Production"
```

## 3. Verify Installation

### Start the Application

```bash
dotnet run --project F1CompanionApi/F1CompanionApi.csproj
```

Look for this log message on startup:

```
Sentry integration enabled. DSN: https://***@sentry.io/***
```

### Test Error Capture

Create a test endpoint or add to an existing one:

```csharp
app.MapGet("/test-sentry", (ILogger<Program> logger) =>
{
    logger.LogInformation("Testing Sentry integration");
    logger.LogWarning("This is a warning message");
    logger.LogError("This is an error message");

    // Test exception capture
    try
    {
        throw new InvalidOperationException("Test exception for Sentry");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Caught test exception");
    }

    return Results.Ok("Check your Sentry dashboard!");
});
```

Visit `http://localhost:5000/test-sentry` and check your Sentry dashboard - you should see the logs and exception appear within a few seconds.

## 4. Environment-Specific Configuration

### Development (appsettings.Development.json)

```json
{
  "Sentry": {
    "Debug": true,
    "TracesSampleRate": 1.0,
    "MinimumEventLevel": "Information"
  }
}
```

### Production (appsettings.Production.json)

```json
{
  "Sentry": {
    "Debug": false,
    "TracesSampleRate": 0.1,
    "MinimumEventLevel": "Error",
    "Environment": "Production"
  }
}
```

## 5. Start Using Structured Logging

Replace console logging with structured ILogger calls:

```csharp
// Before
Console.WriteLine($"User {userId} created league {leagueId}");

// After
_logger.LogInformation("User {UserId} created league {LeagueId}", userId, leagueId);
```

## Next Steps

- Read the full [Sentry Integration Guidelines](instructions/sentry.md)
- Configure alerts in your Sentry dashboard
- Set up team notifications
- Review performance monitoring data
- Customize error grouping rules

## Troubleshooting

**No events appearing in Sentry?**

- Verify your DSN is correct
- Check that `Experimental.EnableLogs` is `true`
- Ensure log level meets `MinimumEventLevel` threshold
- Look for Sentry diagnostic messages in console output (enable `Debug: true`)

**Too many events?**

- Increase `MinimumEventLevel` to `Warning` or `Error`
- Reduce `TracesSampleRate` to 0.1 (10%)
- Add filtering in `BeforeSend` callback

**Need help?**

- Check [Sentry documentation](https://docs.sentry.io/platforms/dotnet/)
- Review [.github/instructions/sentry.md](instructions/sentry.md)
- Contact your team lead
