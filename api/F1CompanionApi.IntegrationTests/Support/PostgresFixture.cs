using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Starts one Postgres container for the whole test run and applies EF migrations once
/// against it. Shared across integration test classes via IntegrationTestCollection.
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

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Apply migrations once — every test class shares the same schema.
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var dbContext = new ApplicationDbContext(options);
        await dbContext.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }
}
