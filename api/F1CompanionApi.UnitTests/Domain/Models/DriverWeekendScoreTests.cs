using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class DriverWeekendScoreTests
{
    private static DriverSessionScore Session(int positionPoints, int positionChange = 0) =>
        new(positionPoints, positionChange, 0, 0, 0);

    [Fact]
    public void TotalPoints_SumsAllSessionTotals()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: 10,
            Sprint: Session(8),
            GrandPrix: Session(25)
        );

        Assert.Equal(43, score.TotalPoints);
    }

    [Fact]
    public void NullSessions_ContributeZeroToTotalPoints()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: null,
            Sprint: null,
            GrandPrix: null
        );

        Assert.Equal(0, score.TotalPoints);
    }
}
