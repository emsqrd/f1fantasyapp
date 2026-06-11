using System.Text.Json;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class MeProfileTests : IntegrationTestBase
{
    public MeProfileTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetMyProfile_WithTeam_ReturnsHasTeamTrueAndNoTeamField()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            await db.CreateTeamAsync(profile.Id);
        });

        var response = await client.GetAsync("/api/me/profile");
        response.EnsureSuccessStatusCode();

        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var root = doc.RootElement;

        Assert.True(root.TryGetProperty("hasTeam", out var hasTeam));
        Assert.True(hasTeam.GetBoolean());
        Assert.False(root.TryGetProperty("team", out _));
    }
}
