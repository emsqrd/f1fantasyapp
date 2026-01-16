using System.Diagnostics;
using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Data;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Extensions;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Initialize Sentry early in the application startup
builder.WebHost.UseSentry(options =>
{
    // DSN and basic configuration from appsettings.json
    options.Dsn = builder.Configuration["Sentry:Dsn"];
    options.Debug = builder.Configuration.GetValue<bool>("Sentry:Debug");
    options.Environment = builder.Configuration["Sentry:Environment"] ?? builder.Environment.EnvironmentName;

    // Enable Spotlight for local development
    if (builder.Environment.IsDevelopment())
    {
        options.EnableSpotlight = true;
        options.SpotlightUrl = "http://localhost:8969/stream";
    }

    // Enable structured logging
    options.Experimental.EnableLogs = true;

    // Performance monitoring (can be overridden via Sentry__TracesSampleRate env var)
    options.TracesSampleRate = builder.Configuration.GetValue<double?>("Sentry:TracesSampleRate") ?? 0.1;

    // Filtering callback to exclude server name for privacy
    options.SetBeforeSend((@event, hint) =>
    {
        // Never report server names for privacy
        @event.ServerName = null;
        return @event;
    });

    // Filtering callback for structured logs
    options.Experimental.SetBeforeSendLog(log =>
    {
        // Filter out trace and debug logs in production
        if (!builder.Environment.IsDevelopment() &&
            (log.Level is Sentry.SentryLogLevel.Debug || log.Level is Sentry.SentryLogLevel.Trace))
        {
            return null;
        }

        return log;
    });
});

builder.Services.AddOpenApi();
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        // Add trace ID for debugging
        context.ProblemDetails.Extensions["traceId"] =
            Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;

        // Add timestamp
        context.ProblemDetails.Extensions["timestamp"] = DateTime.UtcNow;

        // Add environment for all environments
        context.ProblemDetails.Extensions["environment"] = builder.Environment.EnvironmentName;
    };
});

// Register global exception handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.AddApplicationServices();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseCors("AllowedOrigins");
app.UseAuthentication();
app.UseAuthorization();

// Only auto-migrate in development
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    dbContext.Database.Migrate();
}

app.MapEndpoints().MapOpenApi();

app.MapScalarApiReference();

app.Run();
