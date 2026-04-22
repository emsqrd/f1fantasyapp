using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Starts one Postgres container for the whole test run, applies EF migrations once,
/// and owns a single <see cref="ApiWebApplicationFactory"/> shared across every test
/// class in the collection. Booting the host once (instead of per-test) is a big win:
/// each test pays only the Respawn truncate cost, not a fresh DI container build.
/// </summary>
public class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("f1_fantasy_tests")
        .WithUsername("test")
        .WithPassword("test")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public ApiWebApplicationFactory Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Apply migrations once — every test class shares the same schema.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        await dbContext.Database.MigrateAsync();

        Factory = new ApiWebApplicationFactory(ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (Factory is not null)
        {
            await Factory.DisposeAsync();
        }
        await _container.DisposeAsync();
    }
}
