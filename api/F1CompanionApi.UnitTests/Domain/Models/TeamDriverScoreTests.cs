using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class TeamDriverScoreTests
{
    private static DriverSessionScore Session(string name, int positionPoints, int penalty = 0) =>
        new(1, name, positionPoints, 0, 0, 0, penalty);

    [Fact]
    public void Captain_DoublesEachSessionIndependently()
    {
        // P1 quali (10), P1 sprint (8), P1 race (25)
        var entityScore = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: 10,
            Sprint: Session("Sprint", 8),
            Race: Session("Race", 25)
        );

        var score = new TeamDriverScore(entityScore, IsCaptain: true);

        Assert.Equal(20, score.AdjustedQualifying);
        Assert.Equal(16, score.AdjustedSprint);
        Assert.Equal(50, score.AdjustedRace);
    }

    [Fact]
    public void Captain_WithDnf_DoublesPenalty()
    {
        // DNF race → -10 raw, -20 as captain
        var entityScore = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: null,
            Sprint: null,
            Race: Session("Race", 0, penalty: -10)
        );

        var score = new TeamDriverScore(entityScore, IsCaptain: true);

        Assert.Equal(-20, score.AdjustedRace);
    }

    [Fact]
    public void NonCaptain_ReturnsRawValuesUnchanged()
    {
        var entityScore = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: 9,
            Sprint: null,
            Race: Session("Race", 18)
        );

        var score = new TeamDriverScore(entityScore, IsCaptain: false);

        Assert.Equal(9, score.AdjustedQualifying);
        Assert.Equal(0, score.AdjustedSprint);
        Assert.Equal(18, score.AdjustedRace);
        Assert.Equal(27, score.AdjustedTotal);
    }

    [Fact]
    public void Captain_DominantDriver_Returns70()
    {
        // P1 quali (10) + P1 race (25) = 35 raw, 70 as captain
        var entityScore = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: 10,
            Sprint: null,
            Race: Session("Race", 25)
        );

        var score = new TeamDriverScore(entityScore, IsCaptain: true);

        Assert.Equal(35, score.EntityScore.TotalPoints);
        Assert.Equal(70, score.AdjustedTotal);
    }
}
