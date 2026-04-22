using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;
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
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        created.Should().NotBeNull();

        var details = await client.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{created!.Id}"
        );
        details.Should().NotBeNull();
        details!.Teams.Should().ContainSingle().Which.Name.Should().Be("Owner Team");
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
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var league = await createResponse.Content.ReadFromJsonAsync<LeagueResponse>();
        league.Should().NotBeNull();

        var inviteResponse = await ownerClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        inviteResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<LeagueInviteTokenResponse>();
        invite.Should().NotBeNull();

        var preview = await friendClient.GetFromJsonAsync<LeagueInviteTokenPreviewResponse>(
            $"/api/leagues/join/{invite!.Token}/preview"
        );
        preview.Should().NotBeNull();
        preview!.LeagueName.Should().Be("Private League");
        preview.CurrentTeamCount.Should().Be(1);
        preview.IsLeagueFull.Should().BeFalse();

        var joinResponse = await friendClient.PostAsync(
            $"/api/leagues/join/{invite.Token}",
            content: null
        );
        joinResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{league.Id}"
        );
        details.Should().NotBeNull();
        details!.Teams.Select(t => t.Name).Should().BeEquivalentTo("Owner Team", "Friend Team");
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
        league.Should().NotBeNull();

        var response = await otherClient.PostAsync(
            $"/api/leagues/{league!.Id}/invite",
            content: null
        );
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var inviteCount = await WithDbAsync(async db =>
            await db.LeagueInvites.CountAsync(i => i.LeagueId == league.Id)
        );
        inviteCount.Should().Be(0);
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
        joinResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);

        var details = await ownerClient.GetFromJsonAsync<LeagueDetailsResponse>(
            $"/api/leagues/{leagueId}"
        );
        details.Should().NotBeNull();
        details!.Teams.Should().HaveCount(2);
    }

    [Fact]
    public async Task UnknownInviteTokenGivesClearError()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/leagues/join/does-not-exist/preview");

        response.IsSuccessStatusCode.Should().BeFalse();
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
