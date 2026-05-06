using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class LeagueStandingsTests : IntegrationTestBase
{
    public LeagueStandingsTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetLeagueStandings_UnknownLeague_Returns404()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/leagues/999999/standings");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetLeagueStandings_Unauthenticated_Returns401()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/leagues/1/standings");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetLeagueStandings_HappyPath_OrdersByPointsAndComputesPositionChange()
    {
        var (client, ownerProfile) = await Factory.CreateAuthenticatedAsync();

        var seed = await SeedAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();

            var league = await CreateLeagueAsync(db, ownerProfile.Id, "Test League");

            var team1 = await db.CreateTeamAsync(ownerProfile.Id, "Team Alpha");
            var profile2 = await CreateUserProfileAsync(db, "p2");
            var team2 = await db.CreateTeamAsync(profile2.Id, "Team Bravo");
            var profile3 = await CreateUserProfileAsync(db, "p3");
            var team3 = await db.CreateTeamAsync(profile3.Id, "Team Charlie");

            await JoinTeamsAsync(db, league.Id, ownerProfile.Id, team1.Id, team2.Id, team3.Id);

            var w1 = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(-7),
                round: 1,
                name: "Round One GP"
            );
            var w2 = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(7),
                round: 2,
                name: "Round Two GP"
            );

            // After w1: team2 leads (50), team1 (30), team3 (10).
            // After w2 cumulative: team1=130, team3=90, team2=60.
            db.TeamLeagueStandings.AddRange(
                Standing(league.Id, team1.Id, w1.Id, position: 2, totalPoints: 30),
                Standing(league.Id, team2.Id, w1.Id, position: 1, totalPoints: 50),
                Standing(league.Id, team3.Id, w1.Id, position: 3, totalPoints: 10),
                Standing(league.Id, team1.Id, w2.Id, position: 1, totalPoints: 130),
                Standing(league.Id, team3.Id, w2.Id, position: 2, totalPoints: 90),
                Standing(league.Id, team2.Id, w2.Id, position: 3, totalPoints: 60)
            );
            // Add a finished GP race result to materialize afterSessionType.
            await AddRaceResultsAsync(db, w2.Id, SessionType.GrandPrix);
            await db.SaveChangesAsync();

            return new
            {
                LeagueId = league.Id,
                T1 = team1.Id,
                T2 = team2.Id,
                T3 = team3.Id,
            };
        });

        var standings = await client.GetFromJsonAsync<LeagueStandingsResponse>(
            $"/api/leagues/{seed.LeagueId}/standings"
        );

        Assert.NotNull(standings);
        Assert.Equal(seed.LeagueId, standings!.LeagueId);
        Assert.Equal(2, standings.TotalRounds);
        Assert.Equal("Round Two GP", standings.AfterRaceWeekendName);
        Assert.Equal(SessionType.GrandPrix, standings.AfterSessionType);

        var ordered = standings.Standings;
        Assert.Equal(3, ordered.Count);

        Assert.Equal(seed.T1, ordered[0].TeamId);
        Assert.Equal(1, ordered[0].Position);
        Assert.Equal(130, ordered[0].TotalPoints);
        Assert.Equal(1, ordered[0].PositionChange);

        Assert.Equal(seed.T3, ordered[1].TeamId);
        Assert.Equal(2, ordered[1].Position);
        Assert.Equal(90, ordered[1].TotalPoints);
        Assert.Equal(1, ordered[1].PositionChange);

        Assert.Equal(seed.T2, ordered[2].TeamId);
        Assert.Equal(3, ordered[2].Position);
        Assert.Equal(60, ordered[2].TotalPoints);
        Assert.Equal(-2, ordered[2].PositionChange);
    }

    [Theory]
    [InlineData(WeekendFormat.Standard, false, false, true, SessionType.GrandPrix)]
    [InlineData(WeekendFormat.Standard, false, true, true, SessionType.GrandPrix)]
    [InlineData(WeekendFormat.Sprint, true, false, false, SessionType.Sprint)]
    [InlineData(WeekendFormat.Sprint, true, true, true, SessionType.GrandPrix)]
    public async Task GetLeagueStandings_AfterSessionType_ReflectsLatestSessionWithResults(
        WeekendFormat format,
        bool hasSprint,
        bool hasQualifying,
        bool hasGrandPrix,
        SessionType expected
    )
    {
        var (client, ownerProfile) = await Factory.CreateAuthenticatedAsync();

        var seed = await SeedAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var weekend = new RaceWeekend
            {
                SeasonId = season.Id,
                Round = 1,
                Name = "Test GP",
                CircuitId = (await db.CreateCircuitAsync()).Id,
                RaceDate = DateTime.UtcNow.AddDays(2),
                WeekendFormat = format,
            };
            db.RaceWeekends.Add(weekend);
            await db.SaveChangesAsync();

            var league = await CreateLeagueAsync(db, ownerProfile.Id, "Format League");
            var team = await db.CreateTeamAsync(ownerProfile.Id, "Team Alpha");
            await JoinTeamsAsync(db, league.Id, ownerProfile.Id, team.Id);

            db.TeamLeagueStandings.Add(
                Standing(league.Id, team.Id, weekend.Id, position: 1, totalPoints: 30)
            );

            if (hasSprint)
            {
                await AddRaceResultsAsync(db, weekend.Id, SessionType.Sprint);
            }
            if (hasQualifying)
            {
                await AddQualifyingResultsAsync(db, weekend.Id);
            }
            if (hasGrandPrix)
            {
                await AddRaceResultsAsync(db, weekend.Id, SessionType.GrandPrix);
            }

            await db.SaveChangesAsync();
            return new { LeagueId = league.Id };
        });

        var standings = await client.GetFromJsonAsync<LeagueStandingsResponse>(
            $"/api/leagues/{seed.LeagueId}/standings"
        );

        Assert.NotNull(standings);
        Assert.Equal(expected, standings!.AfterSessionType);
    }

    private async Task<T> SeedAsync<T>(Func<F1CompanionApi.Data.ApplicationDbContext, Task<T>> seed)
    {
        T result = default!;
        await WithDbAsync(async db =>
        {
            result = await seed(db);
        });
        return result;
    }

    private static async Task<League> CreateLeagueAsync(
        F1CompanionApi.Data.ApplicationDbContext db,
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

    private static async Task<UserProfile> CreateUserProfileAsync(
        F1CompanionApi.Data.ApplicationDbContext db,
        string slug
    )
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
        return profile;
    }

    private static async Task JoinTeamsAsync(
        F1CompanionApi.Data.ApplicationDbContext db,
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

    private static async Task AddRaceResultsAsync(
        F1CompanionApi.Data.ApplicationDbContext db,
        int raceWeekendId,
        SessionType sessionType
    )
    {
        var driver = await db.CreateDriverAsync(
            abbreviation: $"D{Guid.NewGuid():N}"[..3].ToUpperInvariant(),
            firstName: "Race",
            lastName: "Driver"
        );
        db.DriverRacingResults.Add(
            new DriverRacingResult
            {
                DriverId = driver.Id,
                RaceWeekendId = raceWeekendId,
                SessionType = sessionType,
                FinishPosition = 1,
                GridPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RacingStatus.Classified,
                CreatedAt = DateTime.UtcNow,
            }
        );
        await db.SaveChangesAsync();
    }

    private static async Task AddQualifyingResultsAsync(
        F1CompanionApi.Data.ApplicationDbContext db,
        int raceWeekendId
    )
    {
        var driver = await db.CreateDriverAsync(
            abbreviation: $"Q{Guid.NewGuid():N}"[..3].ToUpperInvariant(),
            firstName: "Qual",
            lastName: "Driver"
        );
        db.DriverQualifyingResults.Add(
            new DriverQualifyingResult
            {
                DriverId = driver.Id,
                RaceWeekendId = raceWeekendId,
                Position = 1,
                Status = RacingStatus.Classified,
                CreatedAt = DateTime.UtcNow,
            }
        );
        await db.SaveChangesAsync();
    }
}
