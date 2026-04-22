using F1CompanionApi.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Respawn;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Hosts the real API in-process against the Postgres test container.
/// Overrides the connection string, swaps the production <see cref="JwtBearerHandler"/>
/// for <see cref="TestJwtBearerHandler"/> via DI (leaving the auth scheme registration
/// untouched), and exposes helpers for resetting mutable state between tests via Respawn.
/// </summary>
public class ApiWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string TestApiKey = "integration-test-api-key";

    private readonly string _connectionString;
    private Respawner? _respawner;

    public ApiWebApplicationFactory(string connectionString)
    {
        _connectionString = connectionString;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration(
            (_, config) =>
            {
                config.AddInMemoryCollection(
                    new Dictionary<string, string?>
                    {
                        ["ConnectionStrings:DefaultConnection"] = _connectionString,
                        ["Supabase:AuthUrl"] = "https://example.supabase.co",
                        ["Sentry:Dsn"] = string.Empty,
                        ["Authentication:ApiKey"] = TestApiKey,
                    }
                );
            }
        );

        builder.ConfigureTestServices(services =>
        {
            // Replace the DbContext registration to ensure the retry policy stays
            // but the connection points at the container — also drops the interceptor
            // which is not required for tests.
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(
                    _connectionString,
                    npgsql =>
                        npgsql.EnableRetryOnFailure(
                            maxRetryCount: 3,
                            maxRetryDelay: TimeSpan.FromSeconds(5),
                            errorCodesToAdd: null
                        )
                )
            );

            // Swap the concrete JwtBearerHandler for the test stand-in. The "Bearer"
            // scheme registration, options, policies, and the "ApiKey" scheme all stay
            // intact — only the handler instance the framework resolves changes.
            services.Replace(ServiceDescriptor.Transient<JwtBearerHandler, TestJwtBearerHandler>());
        });
    }

    /// <summary>
    /// Resets mutable state between tests. Schema (migrations) is created once by
    /// <see cref="PostgresFixture"/>; Respawn just truncates data rows.
    /// </summary>
    public async Task ResetDatabaseAsync()
    {
        await using var connection = new Npgsql.NpgsqlConnection(_connectionString);
        await connection.OpenAsync();

        _respawner ??= await Respawner.CreateAsync(
            connection,
            new RespawnerOptions
            {
                DbAdapter = DbAdapter.Postgres,
                SchemasToInclude = ["public"],
                TablesToIgnore = [new Respawn.Graph.Table("__EFMigrationsHistory")],
            }
        );

        await _respawner.ResetAsync(connection);
    }
}
