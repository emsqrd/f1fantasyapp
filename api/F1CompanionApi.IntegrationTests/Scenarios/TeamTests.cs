using System.Net;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class TeamTests : IntegrationTestBase
{
    public TeamTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetTeamById_Unauthenticated_Returns401()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/teams/1");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetTeamById_Authenticated_ReturnsTeam()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        var team = await WithDbAsync(async db =>
            await db.CreateTeamAsync(profile.Id, name: "My Team")
        );

        var response = await client.GetAsync($"/api/teams/{team.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetAllTeams_NoLongerSupported_Returns405()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/teams");

        // POST /teams still exists at this path, so the routing layer rejects
        // the unsupported GET verb with 405 rather than 404.
        Assert.Equal(HttpStatusCode.MethodNotAllowed, response.StatusCode);
    }
}
