using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class DriverWeekendScoreTests
{
    private static DriverSessionScore Session(
        string name,
        int positionPoints,
        int positionChange = 0
    ) => new(1, name, positionPoints, positionChange, 0, 0, 0);

    [Fact]
    public void TotalPoints_SumsAllSessionTotals()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: 10,
            Sprint: Session("Sprint", 8),
            Race: Session("Race", 25)
        );

        Assert.Equal(43, score.TotalPoints);
    }

    [Fact]
    public void NullSessions_ContributeZeroToTotalPoints()
    {
        var score = new DriverWeekendScore(DriverId: 1, Qualifying: null, Sprint: null, Race: null);

        Assert.Equal(0, score.TotalPoints);
    }
}
