using F1CompanionApi.Data;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace F1CompanionApi.Extensions;

public static class ServiceExtensions
{
    public static void AddApplicationServices(this IHostApplicationBuilder builder)
    {
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddProblemDetails();

        // Configure Sentry logging integration
        builder.Services.AddLogging(logging =>
        {
            // Sentry automatically integrates with ILogger when initialized via UseSentry()
            // This ensures all ILogger calls are captured as structured logs in Sentry
            logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
        });

        // Register non-generic ILogger for endpoints (creates logger with "F1CompanionApi.Api.Endpoints" category)
        builder.Services.AddSingleton(serviceProvider =>
            serviceProvider
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger("F1CompanionApi.Api.Endpoints")
        );

        builder.Services.AddServices(builder.Configuration);
        builder.Services.AddDbContext(builder.Configuration);

        builder.Services.AddCors(options =>
        {
            var allowedOrigins =
                builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? [];

            options.AddPolicy(
                "AllowedOrigins",
                policy =>
                {
                    policy
                        .SetIsOriginAllowed(origin =>
                        {
                            // Check exact matches first
                            if (allowedOrigins.Contains(origin))
                                return true;

                            // Check for Netlify preview deployments
                            if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                            {
                                return uri.Host.EndsWith(
                                    ".netlify.app",
                                    StringComparison.OrdinalIgnoreCase
                                );
                            }

                            return false;
                        })
                        .AllowAnyHeader()
                        .AllowAnyMethod()
                        .AllowCredentials();
                }
            );
        });
    }

    private static void AddDbContext(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ConnectionDiagnosticsInterceptor>();

        var connectionString =
            configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException(
                "DefaultConnection connection string not configured"
            );

        services.AddDbContext<ApplicationDbContext>(
            (serviceProvider, options) =>
                options
                    .UseNpgsql(
                        connectionString,
                        npgsqlOptions =>
                            npgsqlOptions.EnableRetryOnFailure(
                                maxRetryCount: 3,
                                maxRetryDelay: TimeSpan.FromSeconds(5),
                                errorCodesToAdd: null
                            )
                    )
                    .AddInterceptors(
                        serviceProvider.GetRequiredService<ConnectionDiagnosticsInterceptor>()
                    )
        );
    }

    private static void AddServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<ISupabaseAuthService, SupabaseAuthService>();

        var authUrl =
            configuration["Supabase:AuthUrl"]
            ?? throw new InvalidOperationException("Supabase auth URL not configured");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = authUrl;
                options.RequireHttpsMetadata = authUrl.StartsWith(
                    "https://",
                    StringComparison.OrdinalIgnoreCase
                );

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = true,
                    ValidAudience = "authenticated",
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.Zero,
                };
            });

        services.AddAuthorization();
        services.AddHttpContextAccessor();
        services.AddScoped<IConstructorService, ConstructorService>();
        services.AddScoped<IDriverService, DriverService>();
        services.AddScoped<ILeagueService, LeagueService>();
        services.AddScoped<ILeagueInviteService, LeagueInviteService>();
        services.AddScoped<IRaceResultService, RaceResultService>();
        services.AddScoped<IRaceService, RaceService>();
        services.AddScoped<ISeasonService, SeasonService>();
        services.AddScoped<IScoringService, ScoringService>();
        services.AddScoped<ITeamService, TeamService>();
        services.AddScoped<IUserProfileService, UserProfileService>();
    }
}
