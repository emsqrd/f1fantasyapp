using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class ConstructorWeekendScoreTests
{
    [Fact]
    public void QualifyingTotal_SumsBothDriversRawQualifyingPoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Qualifying: 15,
            Sprint: null,
            Race: null
        );

        Assert.Equal(15, constructor.QualifyingTotal);
    }

    [Fact]
    public void SprintTotal_SumsBothDriversRawSprintPoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Qualifying: null,
            Sprint: new DriverSessionScore(13, 0, 0, 0, 0),
            Race: null
        );

        Assert.Equal(13, constructor.SprintTotal);
    }

    [Fact]
    public void RaceTotal_SumsBothDriversRawRacePoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Qualifying: null,
            Sprint: null,
            Race: new DriverSessionScore(28, 0, 0, 0, 0)
        );

        Assert.Equal(28, constructor.RaceTotal);
    }

    [Fact]
    public void Total_SumsAllSessions()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Qualifying: 15,
            Sprint: null,
            Race: new DriverSessionScore(28, 0, 0, 0, 0)
        );

        Assert.Equal(43, constructor.Total);
    }

    [Fact]
    public void NullSessions_ContributeZeroToConstructorTotals()
    {
        var constructor = new ConstructorWeekendScore(ConstructorId: 1, null, null, null);

        Assert.Equal(0, constructor.QualifyingTotal);
        Assert.Equal(0, constructor.SprintTotal);
        Assert.Equal(0, constructor.RaceTotal);
        Assert.Equal(0, constructor.Total);
    }
}
