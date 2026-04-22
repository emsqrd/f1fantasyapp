using System.Net;
using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;

namespace F1CompanionApi.IntegrationTests;

public class SmokeTests : IntegrationTestBase
{
    public SmokeTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetCurrentSeason_ReturnsSeededSeason()
    {
        await WithDbAsync(async db => await db.CreateCurrentSeasonAsync());

        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/seasons/current");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
