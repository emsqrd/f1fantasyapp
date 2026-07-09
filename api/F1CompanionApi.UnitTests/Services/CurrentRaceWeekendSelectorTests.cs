using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.UnitTests.Services;

public class CurrentRaceWeekendSelectorTests
{
    private static readonly DateTime BaseDate = new(2026, 6, 1, 15, 0, 0, DateTimeKind.Utc);

    private static RaceWeekend Weekend(
        int round,
        DateTime? scoredAt = null,
        DateTime? raceDate = null
    ) =>
        new()
        {
            SeasonId = 1,
            Round = round,
            Name = $"Round {round}",
            CircuitId = 1,
            RaceDate = raceDate ?? BaseDate,
            ScoredAt = scoredAt,
        };

    [Fact]
    public void GetCurrentRaceWeekend_NoneScored_ReturnsLowestRound()
    {
        var raceWeekends = new[] { Weekend(round: 3), Weekend(round: 1), Weekend(round: 2) };

        var result = CurrentRaceWeekendSelector.GetCurrentRaceWeekend(raceWeekends);

        Assert.NotNull(result);
        Assert.Equal(1, result!.Round);
    }

    [Fact]
    public void GetCurrentRaceWeekend_SomeScored_ReturnsEarliestUnscored()
    {
        var raceWeekends = new[]
        {
            Weekend(round: 1, scoredAt: BaseDate),
            Weekend(round: 2),
            Weekend(round: 3, scoredAt: BaseDate),
        };

        var result = CurrentRaceWeekendSelector.GetCurrentRaceWeekend(raceWeekends);

        Assert.NotNull(result);
        Assert.Equal(2, result!.Round);
    }

    [Fact]
    public void GetCurrentRaceWeekend_AllScored_ReturnsNull()
    {
        var raceWeekends = new[]
        {
            Weekend(round: 1, scoredAt: BaseDate),
            Weekend(round: 2, scoredAt: BaseDate),
        };

        var result = CurrentRaceWeekendSelector.GetCurrentRaceWeekend(raceWeekends);

        Assert.Null(result);
    }

    [Fact]
    public void GetCurrentRaceWeekend_Empty_ReturnsNull()
    {
        var result = CurrentRaceWeekendSelector.GetCurrentRaceWeekend([]);

        Assert.Null(result);
    }

    [Fact]
    public void GetCurrentRaceWeekend_UnscoredPastRound_BeatsUnscoredFutureRound()
    {
        var raceWeekends = new[]
        {
            Weekend(round: 1, raceDate: BaseDate.AddDays(-30)),
            Weekend(round: 2, raceDate: BaseDate.AddDays(30)),
        };

        var result = CurrentRaceWeekendSelector.GetCurrentRaceWeekend(raceWeekends);

        Assert.NotNull(result);
        Assert.Equal(1, result!.Round);
    }
}
