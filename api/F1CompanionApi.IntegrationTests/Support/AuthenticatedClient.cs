using System.Net.Http.Headers;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Helpers for producing <see cref="HttpClient"/> instances preloaded with the
/// test-auth header, optionally seeding a <see cref="UserProfile"/> alongside.
/// </summary>
public static class AuthenticatedClient
{
    /// <summary>
    /// Seeds an Account + UserProfile and returns an HttpClient authenticated as that user.
    /// </summary>
    public static async Task<(HttpClient Client, UserProfile Profile)> CreateAuthenticatedAsync(
        this ApiWebApplicationFactory factory,
        string? email = null,
        string? displayName = null
    )
    {
        var accountId = Guid.NewGuid().ToString();
        email ??= $"user-{Guid.NewGuid():N}@test.local";

        var (scope, db) = factory.CreateDbScope();
        await using (scope as IAsyncDisposable ?? new AsyncDisposableWrapper(scope))
        {
            var account = new Account
            {
                Id = accountId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                IsActive = true,
                LastLoginAt = DateTime.UtcNow,
            };
            db.Accounts.Add(account);

            var profile = new UserProfile
            {
                AccountId = accountId,
                Email = email,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
            };
            db.UserProfiles.Add(profile);

            await db.SaveChangesAsync();

            var client = factory.ClientFor(accountId, email);
            return (client, profile);
        }
    }

    /// <summary>
    /// Builds an HttpClient with the test-auth header set. No profile is seeded;
    /// use this when testing unauthenticated / unregistered flows.
    /// </summary>
    public static HttpClient ClientFor(
        this ApiWebApplicationFactory factory,
        string accountId,
        string? email = null
    )
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserIdHeader, accountId);
        if (!string.IsNullOrEmpty(email))
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.UserEmailHeader, email);
        }
        client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json")
        );
        return client;
    }

    private sealed class AsyncDisposableWrapper : IAsyncDisposable
    {
        private readonly IDisposable _inner;

        public AsyncDisposableWrapper(IDisposable inner) => _inner = inner;

        public ValueTask DisposeAsync()
        {
            _inner.Dispose();
            return ValueTask.CompletedTask;
        }
    }
}
