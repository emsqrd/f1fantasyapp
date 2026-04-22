using F1CompanionApi.Data;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace F1CompanionApi.IntegrationTests;

/// <summary>
/// Base class for integration tests. Holds a reference to the shared
/// <see cref="ApiWebApplicationFactory"/> from <see cref="PostgresFixture"/>,
/// resets the database before each test, and exposes helpers for seeding and asserting
/// against persisted state.
/// </summary>
[Collection(IntegrationTestCollection.Name)]
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected ApiWebApplicationFactory Factory { get; }

    protected IntegrationTestBase(PostgresFixture postgres)
    {
        Factory = postgres.Factory;
    }

    public Task InitializeAsync() => Factory.ResetDatabaseAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    /// <summary>
    /// Runs the given action with a scoped <see cref="ApplicationDbContext"/>.
    /// Use for seeding and for asserting persisted state after an HTTP call.
    /// </summary>
    protected async Task WithDbAsync(Func<ApplicationDbContext, Task> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await action(db);
    }

    protected async Task<T> WithDbAsync<T>(Func<ApplicationDbContext, Task<T>> action)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await action(db);
    }
}
