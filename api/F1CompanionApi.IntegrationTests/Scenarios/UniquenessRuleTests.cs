using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class UniquenessRuleTests : IntegrationTestBase
{
    public UniquenessRuleTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task PlayerCannotOwnTwoTeams()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var first = await client.PostAsJsonAsync(
            "/api/teams",
            new CreateTeamRequest { Name = "First Team" }
        );
        first.StatusCode.Should().Be(HttpStatusCode.Created);

        var second = await client.PostAsJsonAsync(
            "/api/teams",
            new CreateTeamRequest { Name = "Second Team" }
        );
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        team.Should().NotBeNull();
        team!.Name.Should().Be("First Team");
    }

    [Fact]
    public async Task PlayerCannotPickTheSameDriverTwice()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        int driverId = 0;
        await WithDbAsync(async db =>
        {
            await db.CreateCurrentSeasonAsync();
            var team = await db.CreateTeamAsync(profile.Id);
            var driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");
            driverId = driver.Id;

            db.TeamDrivers.Add(
                new TeamDriver
                {
                    TeamId = team.Id,
                    DriverId = driver.Id,
                    SlotPosition = 0,
                    CreatedBy = profile.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            await db.SaveChangesAsync();
        });

        var response = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driverId, SlotPosition = 1 }
        );
        response.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        team.Should().NotBeNull();
        team!.Drivers.Should().ContainSingle();
    }

    [Fact]
    public async Task PlayerCannotJoinTheSameLeagueTwice()
    {
        var (ownerClient, ownerProfile) = await Factory.CreateAuthenticatedAsync();
        var (joinerClient, joinerProfile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            await db.CreateTeamAsync(ownerProfile.Id, name: "Owner Team");
            await db.CreateTeamAsync(joinerProfile.Id, name: "Joiner Team");
        });

        var createResponse = await ownerClient.PostAsJsonAsync(
            "/api/leagues/",
            new CreateLeagueRequest { Name = "Private League", IsPrivate = true }
        );
        var league = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        league.Should().NotBeNull();

        var inviteResponse = await ownerClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        var invite = await inviteResponse.Content.ReadFromJsonAsync<LeagueInviteTokenResponse>();
        invite.Should().NotBeNull();

        var firstJoin = await joinerClient.PostAsync(
            $"/api/leagues/join/{invite!.Token}",
            content: null
        );
        firstJoin.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondJoin = await joinerClient.PostAsync(
            $"/api/leagues/join/{invite.Token}",
            content: null
        );
        secondJoin.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{league.Id}"
        );
        details.Should().NotBeNull();
        details!.Teams.Where(t => t.Name == "Joiner Team").Should().ContainSingle();
    }
}
