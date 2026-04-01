using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class ConstructorWeekendScoreTests
{
    private static DriverWeekendScore MakeDriver(
        int id,
        int qualPoints,
        int sprintPoints,
        int racePoints,
        bool isCaptain = false
    ) =>
        new(
            DriverId: id,
            Qualifying: qualPoints,
            Sprint: new DriverSessionScore(id, "Sprint", sprintPoints, 0, 0, 0, 0),
            Race: new DriverSessionScore(id, "Race", racePoints, 0, 0, 0, 0),
            IsCaptain: isCaptain
        );

    [Fact]
    public void QualifyingTotal_SumsBothDriversRawQualifyingPoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Driver1: MakeDriver(1, qualPoints: 9, sprintPoints: 0, racePoints: 18),
            Driver2: MakeDriver(2, qualPoints: 6, sprintPoints: 0, racePoints: 10)
        );

        Assert.Equal(15, constructor.QualifyingTotal);
    }

    [Fact]
    public void SprintTotal_SumsBothDriversRawSprintPoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Driver1: MakeDriver(1, qualPoints: 0, sprintPoints: 8, racePoints: 0),
            Driver2: MakeDriver(2, qualPoints: 0, sprintPoints: 5, racePoints: 0)
        );

        Assert.Equal(13, constructor.SprintTotal);
    }

    [Fact]
    public void RaceTotal_SumsBothDriversRawRacePoints()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Driver1: MakeDriver(1, qualPoints: 0, sprintPoints: 0, racePoints: 18),
            Driver2: MakeDriver(2, qualPoints: 0, sprintPoints: 0, racePoints: 10)
        );

        Assert.Equal(28, constructor.RaceTotal);
    }

    [Fact]
    public void Total_SumsAllSessions()
    {
        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Driver1: MakeDriver(1, qualPoints: 9, sprintPoints: 0, racePoints: 18),
            Driver2: MakeDriver(2, qualPoints: 6, sprintPoints: 0, racePoints: 10)
        );

        Assert.Equal(43, constructor.Total);
    }

    [Fact]
    public void CaptainMultiplierOnOneDriver_DoesNotAffectConstructorTotals()
    {
        var captainDriver = MakeDriver(
            1,
            qualPoints: 9,
            sprintPoints: 0,
            racePoints: 18,
            isCaptain: true
        );
        var regularDriver = MakeDriver(
            2,
            qualPoints: 6,
            sprintPoints: 0,
            racePoints: 10,
            isCaptain: false
        );

        var constructor = new ConstructorWeekendScore(
            ConstructorId: 1,
            Driver1: captainDriver,
            Driver2: regularDriver
        );

        Assert.Equal(15, constructor.QualifyingTotal);
        Assert.Equal(28, constructor.RaceTotal);
        Assert.Equal(43, constructor.Total);
    }

    [Fact]
    public void NullSessions_ContributeZeroToConstructorTotals()
    {
        var driver1 = new DriverWeekendScore(1, null, null, null, false);
        var driver2 = new DriverWeekendScore(2, null, null, null, false);

        var constructor = new ConstructorWeekendScore(ConstructorId: 1, driver1, driver2);

        Assert.Equal(0, constructor.QualifyingTotal);
        Assert.Equal(0, constructor.SprintTotal);
        Assert.Equal(0, constructor.RaceTotal);
        Assert.Equal(0, constructor.Total);
    }
}
