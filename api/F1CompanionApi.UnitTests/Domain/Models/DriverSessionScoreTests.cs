using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class DriverSessionScoreTests
{
    [Fact]
    public void Total_SumsAllComponents()
    {
        var score = new DriverSessionScore(
            DriverId: 1,
            SessionName: "Race",
            PositionPoints: 25,
            PositionChangePoints: 3,
            OvertakePoints: 2,
            FastestLapPoints: 3,
            PenaltyPoints: 0
        );

        Assert.Equal(33, score.Total);
    }

    [Fact]
    public void Total_WithNegativePenalty_SumsCorrectly()
    {
        var score = new DriverSessionScore(
            DriverId: 1,
            SessionName: "Race",
            PositionPoints: 0,
            PositionChangePoints: 0,
            OvertakePoints: 2,
            FastestLapPoints: 3,
            PenaltyPoints: -10
        );

        Assert.Equal(-5, score.Total);
    }

    [Fact]
    public void Total_MixedPositiveAndNegative_SumsCorrectly()
    {
        var score = new DriverSessionScore(
            DriverId: 1,
            SessionName: "Sprint",
            PositionPoints: 0,
            PositionChangePoints: -3,
            OvertakePoints: 1,
            FastestLapPoints: 2,
            PenaltyPoints: -5
        );

        Assert.Equal(-5, score.Total);
    }
}
