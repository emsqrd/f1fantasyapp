using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.Extensions.DependencyInjection;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class CurrentRaceWeekendTests : IntegrationTestBase
{
    public CurrentRaceWeekendTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetCurrentSeasonRaceWeekendAsync_AllWeekendsUnscored_ReturnsFirstByRound()
    {
        var now = DateTime.UtcNow;

        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync(year: now.Year);

            // Insert out of round order to verify ORDER BY Round (not insertion order).
            // Round 2's RaceDate is in the past — proving scoring-driven, not calendar-driven.
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(7),
                round: 3,
                name: "Round 3"
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-7),
                round: 2,
                name: "Round 2"
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-14),
                round: 1,
                name: "Round 1"
            );
        });

        await using var scope = Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IRaceWeekendService>();

        var result = await service.GetCurrentSeasonRaceWeekendAsync();

        Assert.NotNull(result);
        Assert.Equal(1, result!.Round);
        Assert.Equal("Round 1", result.Name);
    }

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
    public async Task GetCurrentSeasonRaceWeekendAsync_AllScored_ReturnsNull()
    {
        var now = DateTime.UtcNow;

        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync(year: now.Year);

            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-21),
                round: 1,
                name: "Round 1",
                scoredAt: now.AddDays(-20)
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-14),
                round: 2,
                name: "Round 2",
                scoredAt: now.AddDays(-13)
            );
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: now.AddDays(-7),
                round: 3,
                name: "Round 3",
                scoredAt: now.AddDays(-6)
            );
        });

        await using var scope = Factory.Services.CreateAsyncScope();
        var service = scope.ServiceProvider.GetRequiredService<IRaceWeekendService>();

        var result = await service.GetCurrentSeasonRaceWeekendAsync();

        Assert.Null(result);
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
}
