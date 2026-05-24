using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class MeStandingsTests : IntegrationTestBase
{
    public MeStandingsTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetMyStandings_Unauthenticated_Returns401()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/me/standings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMyStandings_NoTeam_ReturnsEmptyArray()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var standings = await client.GetFromJsonAsync<List<MyLeagueStandingResponse>>(
            "/api/me/standings"
        );

        Assert.NotNull(standings);
        Assert.Empty(standings!);
    }

    [Fact]
    public async Task GetMyStandings_LeagueWithScoredRounds_ReturnsLatestRoundPositionAndPoints()
    {
        var (client, callerProfile) = await Factory.CreateAuthenticatedAsync();

        var leagueId = await SeedAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var callerTeam = await db.CreateTeamAsync(callerProfile.Id, "Caller Team");

            var league = await CreateLeagueAsync(db, callerProfile.Id, "Scored League");
            var other1 = await CreateExtraTeamAsync(db, "a1");
            var other2 = await CreateExtraTeamAsync(db, "a2");
            await JoinTeamsAsync(
                db,
                league.Id,
                callerProfile.Id,
                callerTeam.Id,
                other1.Id,
                other2.Id
            );

            var w1 = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(-21),
                round: 1,
                name: "Round One GP"
            );
            var w2 = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(-14),
                round: 2,
                name: "Round Two GP"
            );

            // Insert out of round order so latest-round-pick isn't accidentally
            // satisfied by insertion order.
            db.TeamLeagueStandings.AddRange(
                Standing(league.Id, callerTeam.Id, w2.Id, position: 1, totalPoints: 130),
                Standing(league.Id, callerTeam.Id, w1.Id, position: 2, totalPoints: 30)
            );
            await db.SaveChangesAsync();

            return league.Id;
        });

        var standings = await client.GetFromJsonAsync<List<MyLeagueStandingResponse>>(
            "/api/me/standings"
        );

        var row = Assert.Single(standings!);
        Assert.Equal(leagueId, row.LeagueId);
        Assert.Equal("Scored League", row.LeagueName);
        Assert.Equal(3, row.TotalTeams);
        Assert.Equal(1, row.Position);
        Assert.Equal(130, row.TotalPoints);
    }

    [Fact]
    public async Task GetMyStandings_LeagueWithoutScoredRound_ListsLeagueWithNullFields()
    {
        var (client, callerProfile) = await Factory.CreateAuthenticatedAsync();

        var leagueId = await SeedAsync(async db =>
        {
            await db.CreateCurrentSeasonAsync();
            var callerTeam = await db.CreateTeamAsync(callerProfile.Id, "Caller Team");

            var league = await CreateLeagueAsync(db, callerProfile.Id, "Unscored League");
            var other = await CreateExtraTeamAsync(db, "b1");
            await JoinTeamsAsync(db, league.Id, callerProfile.Id, callerTeam.Id, other.Id);

            return league.Id;
        });

        var standings = await client.GetFromJsonAsync<List<MyLeagueStandingResponse>>(
            "/api/me/standings"
        );

        var row = Assert.Single(standings!);
        Assert.Equal(leagueId, row.LeagueId);
        Assert.Equal("Unscored League", row.LeagueName);
        Assert.Equal(2, row.TotalTeams);
        Assert.Null(row.Position);
        Assert.Null(row.TotalPoints);
    }

    [Fact]
    public async Task GetMyStandings_PriorSeasonStandingOnly_ListsLeagueWithNullFields()
    {
        var (client, callerProfile) = await Factory.CreateAuthenticatedAsync();

        var leagueId = await SeedAsync(async db =>
        {
            var currentSeason = await db.CreateCurrentSeasonAsync();
            var priorSeason = new Season
            {
                Year = currentSeason.Year - 1,
                StartDate = DateTime.UtcNow.AddDays(-400),
                EndDate = DateTime.UtcNow.AddDays(-100),
            };
            db.Seasons.Add(priorSeason);
            await db.SaveChangesAsync();

            var callerTeam = await db.CreateTeamAsync(callerProfile.Id, "Caller Team");

            var league = await CreateLeagueAsync(db, callerProfile.Id, "Prior Season League");
            var other = await CreateExtraTeamAsync(db, "c1");
            await JoinTeamsAsync(db, league.Id, callerProfile.Id, callerTeam.Id, other.Id);

            var priorRace = await db.CreateRaceWeekendAsync(
                priorSeason.Id,
                raceDate: DateTime.UtcNow.AddDays(-200),
                round: 1,
                name: "Prior Season Finale"
            );

            db.TeamLeagueStandings.Add(
                Standing(league.Id, callerTeam.Id, priorRace.Id, position: 1, totalPoints: 999)
            );
            await db.SaveChangesAsync();

            return league.Id;
        });

        var standings = await client.GetFromJsonAsync<List<MyLeagueStandingResponse>>(
            "/api/me/standings"
        );

        var row = Assert.Single(standings!);
        Assert.Equal(leagueId, row.LeagueId);
        Assert.Equal("Prior Season League", row.LeagueName);
        Assert.Equal(2, row.TotalTeams);
        Assert.Null(row.Position);
        Assert.Null(row.TotalPoints);
    }

    private async Task<T> SeedAsync<T>(Func<ApplicationDbContext, Task<T>> seed)
    {
        T result = default!;
        await WithDbAsync(async db =>
        {
            result = await seed(db);
        });
        return result;
    }

    private static async Task<League> CreateLeagueAsync(
        ApplicationDbContext db,
        int ownerId,
        string name
    )
    {
        var league = new League
        {
            Name = name,
            OwnerId = ownerId,
            CreatedBy = ownerId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Leagues.Add(league);
        await db.SaveChangesAsync();
        return league;
    }

    private static async Task<Team> CreateExtraTeamAsync(ApplicationDbContext db, string slug)
    {
        var account = new Account
        {
            Id = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
        };
        db.Accounts.Add(account);
        var profile = new UserProfile
        {
            AccountId = account.Id,
            Email = $"{slug}-{Guid.NewGuid():N}@test.local",
            FirstName = slug,
            LastName = "User",
            CreatedAt = DateTime.UtcNow,
        };
        db.UserProfiles.Add(profile);
        await db.SaveChangesAsync();

        return await db.CreateTeamAsync(profile.Id, $"Team {slug}");
    }

    private static async Task JoinTeamsAsync(
        ApplicationDbContext db,
        int leagueId,
        int actingUserId,
        params int[] teamIds
    )
    {
        foreach (var teamId in teamIds)
        {
            db.LeagueTeams.Add(
                new LeagueTeam
                {
                    LeagueId = leagueId,
                    TeamId = teamId,
                    JoinedAt = DateTime.UtcNow,
                    CreatedBy = actingUserId,
                    CreatedAt = DateTime.UtcNow,
                }
            );
        }
        await db.SaveChangesAsync();
    }

    private static TeamLeagueStanding Standing(
        int leagueId,
        int teamId,
        int raceWeekendId,
        int position,
        int totalPoints
    ) =>
        new()
        {
            LeagueId = leagueId,
            TeamId = teamId,
            RaceWeekendId = raceWeekendId,
            Position = position,
            TotalPoints = totalPoints,
            CalculatedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };
}
