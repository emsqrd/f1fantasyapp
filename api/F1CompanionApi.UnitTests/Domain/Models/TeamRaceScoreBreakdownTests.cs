using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class TeamRaceScoreBreakdownTests
{
    private static DriverWeekendScore MakeDriver(
        int id,
        int qualPoints,
        int racePoints,
        bool isCaptain = false
    ) =>
        new(
            DriverId: id,
            Qualifying: new DriverQualifyingScore(id, qualPoints),
            Sprint: null,
            Race: new DriverSessionScore(id, "Race", racePoints, 0, 0, 0, 0),
            IsCaptain: isCaptain
        );

    private static ConstructorWeekendScore MakeConstructor(
        int id,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    ) => new(id, driver1, driver2);

    [Fact]
    public void QualifyingTotal_CombinesDriverAdjustedAndConstructorRaw()
    {
        var driver1 = MakeDriver(1, qualPoints: 10, racePoints: 0, isCaptain: true);
        var driver2 = MakeDriver(2, qualPoints: 9, racePoints: 0);
        var constructorDriver1 = MakeDriver(3, qualPoints: 6, racePoints: 0);
        var constructorDriver2 = MakeDriver(4, qualPoints: 5, racePoints: 0);
        var constructor = MakeConstructor(1, constructorDriver1, constructorDriver2);

        var breakdown = new TeamRaceScoreBreakdown(
            TeamId: 1,
            RaceId: 1,
            DriverScores: [driver1, driver2],
            ConstructorScores: [constructor]
        );

        // driver1 AdjustedQualifying = 10 * 2 = 20, driver2 = 9, constructor = 6 + 5 = 11
        Assert.Equal(40, breakdown.QualifyingTotal);
    }

    [Fact]
    public void RaceTotal_CombinesDriverAdjustedAndConstructorRaw()
    {
        var driver1 = MakeDriver(1, qualPoints: 0, racePoints: 25, isCaptain: true);
        var driver2 = MakeDriver(2, qualPoints: 0, racePoints: 18);
        var constructorDriver1 = MakeDriver(3, qualPoints: 0, racePoints: 10);
        var constructorDriver2 = MakeDriver(4, qualPoints: 0, racePoints: 8);
        var constructor = MakeConstructor(1, constructorDriver1, constructorDriver2);

        var breakdown = new TeamRaceScoreBreakdown(
            TeamId: 1,
            RaceId: 1,
            DriverScores: [driver1, driver2],
            ConstructorScores: [constructor]
        );

        // driver1 AdjustedRace = 25 * 2 = 50, driver2 = 18, constructor = 10 + 8 = 18
        Assert.Equal(86, breakdown.RaceTotal);
    }

    [Fact]
    public void TotalPoints_SumsAllSessionTotals()
    {
        var driver = MakeDriver(1, qualPoints: 10, racePoints: 25);
        var constructorDriver1 = MakeDriver(2, qualPoints: 9, racePoints: 18);
        var constructorDriver2 = MakeDriver(3, qualPoints: 6, racePoints: 10);
        var constructor = MakeConstructor(1, constructorDriver1, constructorDriver2);

        var breakdown = new TeamRaceScoreBreakdown(
            TeamId: 1,
            RaceId: 1,
            DriverScores: [driver],
            ConstructorScores: [constructor]
        );

        Assert.Equal(
            breakdown.QualifyingTotal + breakdown.SprintTotal + breakdown.RaceTotal,
            breakdown.TotalPoints
        );
    }

    [Fact]
    public void EmptyLists_TotalPointsIsZero()
    {
        var breakdown = new TeamRaceScoreBreakdown(
            TeamId: 1,
            RaceId: 1,
            DriverScores: [],
            ConstructorScores: []
        );

        Assert.Equal(0, breakdown.TotalPoints);
    }
}
