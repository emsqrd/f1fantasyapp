using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

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

        var getResults = await client.GetFromJsonAsync<List<DriverQualifyingResultResponse>>(
            resultsUrl
        );
        Assert.NotNull(getResults);
        var roundTripped = Assert.Single(getResults, r => r.DriverId == dsqDriver.Id);
        Assert.Null(roundTripped.Position);
        Assert.Equal(RacingStatus.DSQ, roundTripped.Status);
    }
}
