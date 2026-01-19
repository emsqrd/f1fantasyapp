using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace F1CompanionApi.Domain.Exceptions;

public class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;
    private readonly IProblemDetailsService _problemDetailsService;

    public GlobalExceptionHandler(
        ILogger<GlobalExceptionHandler> logger,
        IProblemDetailsService problemDetailsService)
    {
        ArgumentNullException.ThrowIfNull(logger, nameof(logger));
        ArgumentNullException.ThrowIfNull(problemDetailsService, nameof(problemDetailsService));

        _logger = logger;
        _problemDetailsService = problemDetailsService;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        // Handle different exception types
        var (statusCode, title, detail) = exception switch
        {
            // Custom Domain Exceptions - Resource Not Found
            LeagueNotFoundException ex =>
                (StatusCodes.Status404NotFound,
                 "League Not Found",
                 ex.Message),

            // Custom Domain Exceptions - Authentication/Authorization
            UserProfileNotFoundException _ =>
                (StatusCodes.Status400BadRequest,
                 "User Profile Required",
                 "Please complete your registration before accessing this resource."),

            TeamNotFoundException _ =>
                (StatusCodes.Status400BadRequest,
                 "Team Required",
                 "Please create a team before creating a league."),

            TeamOwnershipException _ =>
                (StatusCodes.Status403Forbidden,
                 "Permission Denied",
                 "You do not have permission to modify this team."),

            LeagueIsPrivateException ex =>
                (StatusCodes.Status403Forbidden,
                 "Private League",
                 ex.Message),

            // Custom Domain Exceptions - Resource Conflicts
            SlotOccupiedException ex =>
                (StatusCodes.Status409Conflict,
                 "Slot Already Occupied",
                 ex.Message),

            DuplicateTeamException _ =>
                (StatusCodes.Status409Conflict,
                 "Duplicate Team",
                 "You already have a team. Each user can only create one team."),

            EntityAlreadyOnTeamException ex =>
                (StatusCodes.Status409Conflict,
                 "Entity Already on Team",
                 ex.Message),

            AlreadyInLeagueException ex =>
                (StatusCodes.Status409Conflict,
                 "Already in League",
                 ex.Message),

            LeagueFullException ex =>
                (StatusCodes.Status409Conflict,
                 "League Full",
                 ex.Message),

            // Custom Domain Exceptions - Validation Failures
            TeamFullException ex =>
                (StatusCodes.Status400BadRequest,
                 "Team Full",
                 ex.Message),

            InvalidSlotPositionException ex =>
                (StatusCodes.Status400BadRequest,
                 "Invalid Slot Position",
                 ex.Message),

            // Generic Authentication/Authorization (legacy - to be removed after migration)
            InvalidOperationException ex when ex.Message.Contains("User profile not found") =>
                (StatusCodes.Status400BadRequest,
                 "User Profile Required",
                 "Please complete your registration before accessing this resource."),

            InvalidOperationException ex when ex.Message.Contains("User ID not found") =>
                (StatusCodes.Status401Unauthorized,
                 "Authentication Required",
                 "Valid authentication token is required."),

            // Database errors - PostgreSQL
            PostgresException pgEx =>
                HandlePostgresException(pgEx),

            // Database errors - EF Core
            DbUpdateException dbEx when dbEx.InnerException is PostgresException pgEx =>
                HandlePostgresException(pgEx),

            DbUpdateConcurrencyException =>
                (StatusCodes.Status409Conflict,
                 "Concurrency Conflict",
                 "The data was modified by another user. Please refresh and try again."),

            // Business logic violations (generic fallback)
            InvalidOperationException ex =>
                (StatusCodes.Status400BadRequest,
                 "Invalid Operation",
                 ex.Message),

            KeyNotFoundException ex =>
                (StatusCodes.Status404NotFound,
                 "Resource Not Found",
                 ex.Message),

            // Unexpected errors
            _ =>
                (StatusCodes.Status500InternalServerError,
                 "Internal Server Error",
                 "An unexpected error occurred. Please try again later.")
        };

        // Log with appropriate level
        if (statusCode >= 500)
        {
            _logger.LogError(exception,
                "Unhandled exception: {Message}. Status: {StatusCode}",
                exception.Message, statusCode);
        }
        else
        {
            _logger.LogWarning(exception,
                "Client error: {Message}. Status: {StatusCode}",
                exception.Message, statusCode);
        }

        // Write RFC 7807 Problem Details response
        httpContext.Response.StatusCode = statusCode;

        await _problemDetailsService.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = statusCode,
                Title = title,
                Detail = detail,
                Type = $"https://httpstatuses.com/{statusCode}",
                Instance = httpContext.Request.Path
            },
            Exception = statusCode >= 500 ? exception : null
        });

        return true;
    }

    private (int StatusCode, string Title, string Detail) HandlePostgresException(
        PostgresException pgEx)
    {
        return pgEx.SqlState switch
        {
            // 42P01 - Undefined table (schema not migrated)
            "42P01" => (StatusCodes.Status503ServiceUnavailable,
                       "Service Configuration Error",
                       "The service is not properly configured. Please contact support."),

            // 23505 - Unique violation
            "23505" => (StatusCodes.Status409Conflict,
                       "Duplicate Resource",
                       "This resource already exists."),

            // 23503 - Foreign key violation
            "23503" => (StatusCodes.Status400BadRequest,
                       "Invalid Reference",
                       "The referenced resource does not exist."),

            // 23502 - Not null violation
            "23502" => (StatusCodes.Status400BadRequest,
                       "Missing Required Field",
                       "A required field is missing."),

            _ => (StatusCodes.Status500InternalServerError,
                 "Database Error",
                 "A database error occurred. Please try again later.")
        };
    }
}
