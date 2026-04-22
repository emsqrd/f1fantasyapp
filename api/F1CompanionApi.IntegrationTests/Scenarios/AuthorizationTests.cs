using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class AuthorizationTests : IntegrationTestBase
{
    public AuthorizationTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task PlayerCannotModifyAnotherPlayersTeam()
    {
        var (clientA, profileA) = await Factory.CreateAuthenticatedAsync();
        var (clientB, profileB) = await Factory.CreateAuthenticatedAsync();

        int teamAId = 0;
        int driverIdForB = 0;
        await WithDbAsync(async db =>
        {
            var teamA = await db.CreateTeamAsync(profileA.Id, name: "Team A");
            await db.CreateTeamAsync(profileB.Id, name: "Team B");
            await db.CreateCurrentSeasonAsync();
            var driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");

            teamAId = teamA.Id;
            driverIdForB = driver.Id;
        });

        var response = await clientB.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driverIdForB, SlotPosition = 0 }
        );
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var teamA = await clientA.GetFromJsonAsync<TeamDetailsResponse>($"/api/teams/{teamAId}");
        teamA.Should().NotBeNull();
        teamA!.Drivers.Should().BeEmpty();
    }

    [Fact]
    public async Task UnauthenticatedCallerCannotAccessProtectedEndpoints()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/me/profile");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task LookingUpAMissingTeamGivesAClearError()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/teams/999999");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
