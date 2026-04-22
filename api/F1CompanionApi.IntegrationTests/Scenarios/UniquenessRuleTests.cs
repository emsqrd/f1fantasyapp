using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

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
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await client.PostAsJsonAsync(
            "/api/teams",
            new CreateTeamRequest { Name = "Second Team" }
        );
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Equal("First Team", team!.Name);
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
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Single(team!.Drivers);
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
        Assert.NotNull(league);

        var inviteResponse = await ownerClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        var invite = await inviteResponse.Content.ReadFromJsonAsync<LeagueInviteTokenResponse>();
        Assert.NotNull(invite);

        var firstJoin = await joinerClient.PostAsync(
            $"/api/leagues/join/{invite!.Token}",
            content: null
        );
        Assert.Equal(HttpStatusCode.OK, firstJoin.StatusCode);

        var secondJoin = await joinerClient.PostAsync(
            $"/api/leagues/join/{invite.Token}",
            content: null
        );
        Assert.Equal(HttpStatusCode.Conflict, secondJoin.StatusCode);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{league.Id}"
        );
        Assert.NotNull(details);
        Assert.Single(details!.Teams, t => t.Name == "Joiner Team");
    }
}
