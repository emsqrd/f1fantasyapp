using F1CompanionApi.Data;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace F1CompanionApi.IntegrationTests;

/// <summary>
/// Base class for integration tests. Owns the <see cref="ApiWebApplicationFactory"/>,
/// resets the database before each test, and exposes helpers for seeding and asserting
/// against persisted state.
/// </summary>
[Collection(IntegrationTestCollection.Name)]
public abstract class IntegrationTestBase : IAsyncLifetime
{
    private readonly PostgresFixture _postgres;

    protected ApiWebApplicationFactory Factory { get; private set; } = null!;

    protected IntegrationTestBase(PostgresFixture postgres)
    {
        _postgres = postgres;
    }

    public async Task InitializeAsync()
    {
        Factory = new ApiWebApplicationFactory(_postgres.ConnectionString);
        await Factory.ResetDatabaseAsync();
    }

    public async Task DisposeAsync()
    {
        await Factory.DisposeAsync();
    }

    /// <summary>
    /// Runs the given action with a scoped <see cref="ApplicationDbContext"/>.
    /// Use for seeding and for asserting persisted state after an HTTP call.
    /// </summary>
    protected async Task WithDbAsync(Func<ApplicationDbContext, Task> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await action(db);
    }

    protected async Task<T> WithDbAsync<T>(Func<ApplicationDbContext, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await action(db);
    }
}
