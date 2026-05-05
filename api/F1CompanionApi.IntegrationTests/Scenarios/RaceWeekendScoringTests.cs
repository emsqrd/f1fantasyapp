using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class RaceWeekendScoringTests : IntegrationTestBase
{
    public RaceWeekendScoringTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task NonClassifiedQualifyingEntry_RoundTripsAndScores()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();
        client.DefaultRequestHeaders.Add("X-Api-Key", ApiWebApplicationFactory.TestApiKey);

        Season season = null!;
        RaceWeekend race = null!;
        Driver dsqDriver = null!;
        Driver classifiedDriver = null!;

        await WithDbAsync(async db =>
        {
            season = await db.CreateCurrentSeasonAsync();
            race = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                round: 1
            );
            dsqDriver = await db.CreateDriverAsync("AAA", "First", "One");
            classifiedDriver = await db.CreateDriverAsync("BBB", "First", "Two");
            var constructor = await db.CreateConstructorAsync("TestCo");

            db.SeasonDrivers.Add(
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = dsqDriver.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            db.SeasonDrivers.Add(
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = classifiedDriver.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            await db.SaveChangesAsync();
        });

        var resultsUrl = $"/api/seasons/{season.Id}/race-weekends/{race.Round}/results/qualifying";
        var scoreUrl = $"/api/seasons/{season.Id}/race-weekends/{race.Round}/score";

        var submitResponse = await client.PutAsJsonAsync(
            resultsUrl,
            new[]
            {
                new QualifyingResultItem
                {
                    DriverId = dsqDriver.Id,
                    Position = null,
                    Status = RacingStatus.DSQ,
                },
                new QualifyingResultItem
                {
                    DriverId = classifiedDriver.Id,
                    Position = 1,
                    Status = RacingStatus.Classified,
                },
            }
        );
        Assert.Equal(HttpStatusCode.OK, submitResponse.StatusCode);

        var scoreResponse = await client.PostAsync(scoreUrl, content: null);
        Assert.Equal(HttpStatusCode.NoContent, scoreResponse.StatusCode);

        await WithDbAsync(async db =>
        {
            var constructorScored = await db.ConstructorRaceWeekendScores.AnyAsync(s =>
                s.RaceWeekendId == race.Id
            );
            Assert.True(constructorScored);
        });

        var getResults = await client.GetFromJsonAsync<List<DriverQualifyingResultResponse>>(
            resultsUrl
        );
        Assert.NotNull(getResults);
        var roundTripped = Assert.Single(getResults, r => r.DriverId == dsqDriver.Id);
        Assert.Null(roundTripped.Position);
        Assert.Equal(RacingStatus.DSQ, roundTripped.Status);
    }

    [Fact]
    public async Task Scoring_WithSeededLeague_PersistsLeagueStandingsRows()
    {
        var (client, owner) = await Factory.CreateAuthenticatedAsync();
        client.DefaultRequestHeaders.Add("X-Api-Key", ApiWebApplicationFactory.TestApiKey);

        Season season = null!;
        RaceWeekend race = null!;
        Team teamA = null!;
        Team teamB = null!;
        int leagueId = 0;

        await WithDbAsync(async db =>
        {
            season = await db.CreateCurrentSeasonAsync();
            race = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                round: 1
            );

            var driverA = await db.CreateDriverAsync("AAA", "Alpha", "One");
            var driverB = await db.CreateDriverAsync("BBB", "Bravo", "Two");
            var constructor = await db.CreateConstructorAsync("Constructor1");

            db.SeasonDrivers.AddRange(
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = driverA.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                },
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = driverB.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            // Two teams owned by the authenticated user (UserId is unique per Team) — we only
            // need separate team rows; ownership semantics aren't exercised here.
            var ownerB = new Account
            {
                Id = Guid.NewGuid().ToString(),
                CreatedAt = DateTime.UtcNow,
                IsActive = true,
            };
            db.Accounts.Add(ownerB);
            var profileB = new UserProfile
            {
                AccountId = ownerB.Id,
                Email = $"b-{Guid.NewGuid():N}@test.local",
                CreatedAt = DateTime.UtcNow,
            };
            db.UserProfiles.Add(profileB);
            await db.SaveChangesAsync();

            teamA = await db.CreateTeamAsync(owner.Id, "Team A");
            teamB = await db.CreateTeamAsync(profileB.Id, "Team B");

            var league = new League
            {
                Name = "Test League",
                OwnerId = owner.Id,
                CreatedBy = owner.Id,
                CreatedAt = DateTime.UtcNow,
            };
            db.Leagues.Add(league);
            await db.SaveChangesAsync();
            leagueId = league.Id;

            db.LeagueTeams.AddRange(
                new LeagueTeam
                {
                    LeagueId = league.Id,
                    TeamId = teamA.Id,
                    CreatedBy = owner.Id,
                    CreatedAt = DateTime.UtcNow,
                },
                new LeagueTeam
                {
                    LeagueId = league.Id,
                    TeamId = teamB.Id,
                    CreatedBy = owner.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            // Lineups: A picks driver A (winner), B picks driver B (5th)
            db.LineupEntries.AddRange(
                new LineupEntry
                {
                    TeamId = teamA.Id,
                    RaceWeekendId = race.Id,
                    EntityId = driverA.Id,
                    EntityType = LineupEntityType.Driver,
                    SlotPosition = 1,
                    IsCaptain = false,
                },
                new LineupEntry
                {
                    TeamId = teamB.Id,
                    RaceWeekendId = race.Id,
                    EntityId = driverB.Id,
                    EntityType = LineupEntityType.Driver,
                    SlotPosition = 1,
                    IsCaptain = false,
                }
            );

            await db.SaveChangesAsync();
        });

        var qualifyingUrl =
            $"/api/seasons/{season.Id}/race-weekends/{race.Round}/results/qualifying";
        var raceUrl = $"/api/seasons/{season.Id}/race-weekends/{race.Round}/results/grand-prix";
        var scoreUrl = $"/api/seasons/{season.Id}/race-weekends/{race.Round}/score";

        var driverIds = await GetDriverIdsAsync(season.Id);

        var qualResp = await client.PutAsJsonAsync(
            qualifyingUrl,
            new[]
            {
                new QualifyingResultItem
                {
                    DriverId = driverIds.A,
                    Position = 1,
                    Status = RacingStatus.Classified,
                },
                new QualifyingResultItem
                {
                    DriverId = driverIds.B,
                    Position = 5,
                    Status = RacingStatus.Classified,
                },
            }
        );
        Assert.Equal(HttpStatusCode.OK, qualResp.StatusCode);

        var raceResp = await client.PutAsJsonAsync(
            raceUrl,
            new[]
            {
                new RacingResultItem
                {
                    DriverId = driverIds.A,
                    GridPosition = 1,
                    FinishPosition = 1,
                    Overtakes = 0,
                    FastestLap = false,
                    Status = RacingStatus.Classified,
                },
                new RacingResultItem
                {
                    DriverId = driverIds.B,
                    GridPosition = 5,
                    FinishPosition = 5,
                    Overtakes = 0,
                    FastestLap = false,
                    Status = RacingStatus.Classified,
                },
            }
        );
        Assert.Equal(HttpStatusCode.OK, raceResp.StatusCode);

        var scoreResp = await client.PostAsync(scoreUrl, content: null);
        Assert.Equal(HttpStatusCode.NoContent, scoreResp.StatusCode);

        await WithDbAsync(async db =>
        {
            var standings = await db
                .LeagueStandings.Where(ls => ls.LeagueId == leagueId)
                .OrderBy(ls => ls.Position)
                .ToListAsync();

            Assert.Equal(2, standings.Count);
            Assert.Equal(teamA.Id, standings[0].TeamId);
            Assert.Equal(teamB.Id, standings[1].TeamId);
            Assert.Equal(1, standings[0].Position);
            Assert.Equal(2, standings[1].Position);
            Assert.True(standings[0].TotalPoints >= standings[1].TotalPoints);
        });
    }

    private async Task<(int A, int B)> GetDriverIdsAsync(int seasonId)
    {
        int a = 0,
            b = 0;
        await WithDbAsync(async db =>
        {
            var drivers = await db
                .SeasonDrivers.Where(sd => sd.SeasonId == seasonId)
                .OrderBy(sd => sd.DriverId)
                .Select(sd => sd.DriverId)
                .ToListAsync();
            a = drivers[0];
            b = drivers[1];
        });
        return (a, b);
    }
}
