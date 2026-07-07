using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class CurrentRaceWeekendTests : IntegrationTestBase
{
    public CurrentRaceWeekendTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetCurrentSeasonRaceWeekendAsync_FirstScored_ReturnsSecond()
    {
        var now = DateTime.UtcNow;

        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync(year: now.Year);

            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-14),
                round: 1,
                name: "Round 1",
                scoredAt: now.AddDays(-13)
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-7),
                round: 2,
                name: "Round 2"
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(7),
                round: 3,
                name: "Round 3"
            );
        });

        await using var scope = Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IRaceWeekendService>();

        var result = await service.GetCurrentSeasonRaceWeekendAsync();

        Assert.NotNull(result);
        Assert.Equal(2, result!.Round);
        Assert.Equal("Round 2", result.Name);
    }

    [Fact]
    public async Task GetCurrentSeasonRaceWeekendAsync_OnlyConsidersCurrentSeason()
    {
        var now = DateTime.UtcNow;

        await WithDbAsync(async db =>
        {
            // Past season — its date range no longer covers `now`, so SeasonService
            // will not pick it as current. Its unscored weekend must be ignored.
            var pastSeason = new Season
            {
                Year = now.Year - 1,
                StartDate = now.AddDays(-400),
                EndDate = now.AddDays(-100),
            };
            db.Seasons.Add(pastSeason);
            await db.SaveChangesAsync();

            await db.CreateRaceWeekendAsync(
                pastSeason.Id,
                raceDate: now.AddDays(-200),
                round: 1,
                name: "Past Season Round 1"
            );

            // Current season — SeasonService will resolve this one.
            var currentSeason = await db.CreateCurrentSeasonAsync(year: now.Year);
            await db.CreateRaceWeekendAsync(
                currentSeason.Id,
                raceDate: now.AddDays(7),
                round: 1,
                name: "Current Season Round 1"
            );
        });

        await using var scope = Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IRaceWeekendService>();

        var result = await service.GetCurrentSeasonRaceWeekendAsync();

        Assert.NotNull(result);
        Assert.Equal("Current Season Round 1", result!.Name);
    }

    [Fact]
    public async Task GetCurrentSeasonRaceWeekendAsync_NoCurrentSeason_ReturnsNull()
    {
        var now = DateTime.UtcNow;

        await WithDbAsync(async db =>
        {
            // Only a past season exists — no season covers `now`.
            var pastSeason = new Season
            {
                Year = now.Year - 1,
                StartDate = now.AddDays(-400),
                EndDate = now.AddDays(-100),
            };
            db.Seasons.Add(pastSeason);
            await db.SaveChangesAsync();

            await db.CreateRaceWeekendAsync(
                pastSeason.Id,
                raceDate: now.AddDays(-200),
                round: 1,
                name: "Past Season Round 1"
            );
        });

        await using var scope = Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IRaceWeekendService>();

        var result = await service.GetCurrentSeasonRaceWeekendAsync();

        Assert.Null(result);
    }

    [Fact]
    public async Task RunButUnscoredRound_StaysCurrentAndLocked_UntilScored()
    {
        var now = DateTime.UtcNow;
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        Season season = null!;
        RaceWeekend round1 = null!;
        Driver driver = null!;
        await WithDbAsync(async db =>
        {
            season = await db.CreateCurrentSeasonAsync(year: now.Year);
            round1 = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-1),
                lockDeadline: now.AddDays(-2),
                round: 1,
                name: "Round 1"
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(6),
                lockDeadline: now.AddDays(5),
                round: 2,
                name: "Round 2"
            );
            await db.CreateTeamAsync(profile.Id);
            driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");
        });

        var raceWeekends = await client.GetFromJsonAsync<List<RaceWeekendResponse>>(
            $"/api/seasons/{season.Id}/race-weekends"
        );
        Assert.NotNull(raceWeekends);
        Assert.True(raceWeekends!.Single(r => r.Round == 1).IsCurrent);
        Assert.False(raceWeekends.Single(r => r.Round == 2).IsCurrent);

        var lockedResponse = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driver.Id, SlotPosition = 0 }
        );
        Assert.Equal(HttpStatusCode.Conflict, lockedResponse.StatusCode);

        await WithDbAsync(async db =>
        {
            await db
                .RaceWeekends.Where(r => r.Id == round1.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.ScoredAt, DateTime.UtcNow));
        });

        raceWeekends = await client.GetFromJsonAsync<List<RaceWeekendResponse>>(
            $"/api/seasons/{season.Id}/race-weekends"
        );
        Assert.NotNull(raceWeekends);
        Assert.False(raceWeekends!.Single(r => r.Round == 1).IsCurrent);
        Assert.True(raceWeekends.Single(r => r.Round == 2).IsCurrent);

        var openResponse = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driver.Id, SlotPosition = 0 }
        );
        Assert.Equal(HttpStatusCode.NoContent, openResponse.StatusCode);
    }
}
