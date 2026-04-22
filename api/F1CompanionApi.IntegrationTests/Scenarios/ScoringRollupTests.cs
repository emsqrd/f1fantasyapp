using System.Net;
using F1CompanionApi.Authentication;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class ScoringRollupTests : IntegrationTestBase
{
    public ScoringRollupTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task PlayerSeesTeamScoreUpdateAfterRaceScored()
    {
        var (_, profile) = await Factory.CreateAuthenticatedAsync();

        int seasonId = 0;
        int round = 0;
        int teamId = 0;
        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var race = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(1),
                round: 1
            );
            var team = await db.CreateTeamAsync(profile.Id);
            var d1 = await db.CreateDriverAsync("VER", "Max", "Verstappen");
            var d2 = await db.CreateDriverAsync("PER", "Sergio", "Perez");
            var constructor = await db.CreateConstructorAsync("Red Bull");

            db.SeasonDrivers.AddRange(
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = d1.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                },
                new SeasonDriver
                {
                    SeasonId = season.Id,
                    DriverId = d2.Id,
                    ConstructorId = constructor.Id,
                    IsActive = true,
                }
            );

            db.TeamDrivers.Add(
                new TeamDriver
                {
                    TeamId = team.Id,
                    DriverId = d1.Id,
                    SlotPosition = 0,
                    CreatedBy = profile.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            db.LineupEntries.Add(
                new LineupEntry
                {
                    TeamId = team.Id,
                    RaceWeekendId = race.Id,
                    EntityId = d1.Id,
                    EntityType = LineupEntityType.Driver,
                    SlotPosition = 0,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            db.DriverQualifyingResults.AddRange(
                new DriverQualifyingResult
                {
                    DriverId = d1.Id,
                    RaceWeekendId = race.Id,
                    Position = 1,
                    CreatedAt = DateTime.UtcNow,
                },
                new DriverQualifyingResult
                {
                    DriverId = d2.Id,
                    RaceWeekendId = race.Id,
                    Position = 2,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            db.DriverRacingResults.AddRange(
                new DriverRacingResult
                {
                    DriverId = d1.Id,
                    RaceWeekendId = race.Id,
                    SessionType = SessionType.GrandPrix,
                    GridPosition = 1,
                    FinishPosition = 1,
                    Overtakes = 0,
                    FastestLap = true,
                    Status = RacingStatus.Classified,
                    CreatedAt = DateTime.UtcNow,
                },
                new DriverRacingResult
                {
                    DriverId = d2.Id,
                    RaceWeekendId = race.Id,
                    SessionType = SessionType.GrandPrix,
                    GridPosition = 2,
                    FinishPosition = 2,
                    Overtakes = 0,
                    FastestLap = false,
                    Status = RacingStatus.Classified,
                    CreatedAt = DateTime.UtcNow,
                }
            );

            await db.SaveChangesAsync();

            seasonId = season.Id;
            round = race.Round;
            teamId = team.Id;
        });

        var opsClient = Factory.CreateClient();
        opsClient.DefaultRequestHeaders.Add(
            ApiKeyAuthenticationHandler.HeaderName,
            ApiWebApplicationFactory.TestApiKey
        );

        var response = await opsClient.PostAsync(
            $"/api/seasons/{seasonId}/race-weekends/{round}/score",
            content: null
        );
        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var totalPoints = await WithDbAsync(async db =>
            await db
                .TeamRaceWeekendScores.Where(s => s.TeamId == teamId)
                .Select(s => s.TotalPoints)
                .FirstOrDefaultAsync()
        );
        totalPoints.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task ScoringTriggerIsNotExposedToPlayers()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        int seasonId = 0;
        int round = 0;
        int teamId = 0;
        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var race = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(1),
                round: 1
            );
            var team = await db.CreateTeamAsync(profile.Id);
            seasonId = season.Id;
            round = race.Round;
            teamId = team.Id;
        });

        var response = await client.PostAsync(
            $"/api/seasons/{seasonId}/race-weekends/{round}/score",
            content: null
        );
        response.IsSuccessStatusCode.Should().BeFalse();

        var scoreCount = await WithDbAsync(async db =>
            await db.TeamRaceWeekendScores.CountAsync(s => s.TeamId == teamId)
        );
        scoreCount.Should().Be(0);
    }
}
