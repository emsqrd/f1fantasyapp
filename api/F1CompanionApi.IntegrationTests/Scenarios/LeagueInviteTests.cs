using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class LeagueInviteTests : IntegrationTestBase
{
    public LeagueInviteTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task OwnerCreatesLeagueAndAppearsAsOnlyMember()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            await db.CreateTeamAsync(profile.Id, name: "Owner Team");
        });

        var createResponse = await client.PostAsJsonAsync(
            "/api/leagues/",
            new CreateLeagueRequest
            {
                Name = "My League",
                Description = "Friends only",
                IsPrivate = true,
            }
        );
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        Assert.NotNull(created);

        var details = await client.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{created!.Id}"
        );
        Assert.NotNull(details);
        var only = Assert.Single(details!.Teams);
        Assert.Equal("Owner Team", only.Name);
    }

    [Fact]
    public async Task OwnerSharesInviteAndFriendJoins()
    {
        var (ownerClient, ownerProfile) = await Factory.CreateAuthenticatedAsync();
        var (friendClient, friendProfile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            await db.CreateTeamAsync(ownerProfile.Id, name: "Owner Team");
            await db.CreateTeamAsync(friendProfile.Id, name: "Friend Team");
        });

        var createResponse = await ownerClient.PostAsJsonAsync(
            "/api/leagues/",
            new CreateLeagueRequest { Name = "Private League", IsPrivate = true }
        );
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var league = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        Assert.NotNull(league);

        var inviteResponse = await ownerClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        Assert.Equal(HttpStatusCode.OK, inviteResponse.StatusCode);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<LeagueInviteTokenResponse>();
        Assert.NotNull(invite);

        var preview = await friendClient.GetFromJsonAsync<LeagueInviteTokenPreviewResponse>(
            $"/api/leagues/join/{invite!.Token}/preview"
        );
        Assert.NotNull(preview);
        Assert.Equal("Private League", preview!.LeagueName);
        Assert.Equal(1, preview.CurrentTeamCount);
        Assert.False(preview.IsLeagueFull);

        var joinResponse = await friendClient.PostAsync(
            $"/api/leagues/join/{invite.Token}",
            content: null
        );
        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{league.Id}"
        );
        Assert.NotNull(details);
        Assert.Equal(
            new[] { "Owner Team", "Friend Team" }.OrderBy(n => n),
            details!.Teams.Select(t => t.Name).OrderBy(n => n)
        );
    }

    [Fact]
    public async Task NonOwnerCannotGenerateInvites()
    {
        var (ownerClient, ownerProfile) = await Factory.CreateAuthenticatedAsync();
        var (otherClient, otherProfile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            await db.CreateTeamAsync(ownerProfile.Id, name: "Owner Team");
            await db.CreateTeamAsync(otherProfile.Id, name: "Other Team");
        });

        var createResponse = await ownerClient.PostAsJsonAsync(
            "/api/leagues/",
            new CreateLeagueRequest { Name = "Private League", IsPrivate = true }
        );
        var league = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        Assert.NotNull(league);

        var response = await otherClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);

        var inviteCount = await WithDbAsync(async db =>
            await db.LeagueInvites.CountAsync(i => i.LeagueId == league.Id)
        );
        Assert.Equal(0, inviteCount);
    }

    [Fact]
    public async Task FullLeagueRejectsFurtherJoins()
    {
        var (ownerClient, ownerProfile) = await Factory.CreateAuthenticatedAsync();
        var (memberClient, memberProfile) = await Factory.CreateAuthenticatedAsync();
        var (latecomerClient, latecomerProfile) = await Factory.CreateAuthenticatedAsync();

        var leagueId = 0;
        await WithDbAsync(async db =>
        {
            var ownerTeam = await db.CreateTeamAsync(ownerProfile.Id, name: "Owner Team");
            var memberTeam = await db.CreateTeamAsync(memberProfile.Id, name: "Member Team");
            await db.CreateTeamAsync(latecomerProfile.Id, name: "Latecomer Team");

            var league = new League
            {
                Name = "Tiny League",
                MaxTeams = 2,
                IsPrivate = false,
                OwnerId = ownerProfile.Id,
                CreatedBy = ownerProfile.Id,
                CreatedAt = DateTime.UtcNow,
            };
            db.Leagues.Add(league);
            await db.SaveChangesAsync();

            db.LeagueTeams.Add(
                new LeagueTeam
                {
                    LeagueId = league.Id,
                    TeamId = ownerTeam.Id,
                    JoinedAt = DateTime.UtcNow,
                    CreatedBy = ownerProfile.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            db.LeagueTeams.Add(
                new LeagueTeam
                {
                    LeagueId = league.Id,
                    TeamId = memberTeam.Id,
                    JoinedAt = DateTime.UtcNow,
                    CreatedBy = memberProfile.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            await db.SaveChangesAsync();

            leagueId = league.Id;
        });

        var joinResponse = await latecomerClient.PostAsync(
            $"/api/leagues/{leagueId}/join",
            content: null
        );
        Assert.Equal(HttpStatusCode.Conflict, joinResponse.StatusCode);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{leagueId}"
        );
        Assert.NotNull(details);
        Assert.Equal(2, details!.Teams.Count);
    }

    [Fact]
    public async Task UnknownInviteTokenGivesClearError()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/leagues/join/does-not-exist/preview");

        Assert.False(response.IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
