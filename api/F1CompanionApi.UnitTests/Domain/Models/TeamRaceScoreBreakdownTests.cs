using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class TeamRaceScoreBreakdownTests
{
    private static TeamDriverScore MakeDriver(
        int id,
        int qualPoints,
        int racePoints,
        bool isCaptain = false
    ) =>
        new(
            EntityScore: new DriverWeekendScore(
                DriverId: id,
                Qualifying: qualPoints,
                Sprint: null,
                Race: new DriverSessionScore(id, "Race", racePoints, 0, 0, 0, 0)
            ),
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
        var constructor = MakeConstructor(
            1,
            new DriverWeekendScore(3, 6, null, null),
            new DriverWeekendScore(4, 5, null, null)
        );

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
        var constructor = MakeConstructor(
            1,
            new DriverWeekendScore(
                3,
                null,
                null,
                new DriverSessionScore(3, "Race", 10, 0, 0, 0, 0)
            ),
            new DriverWeekendScore(4, null, null, new DriverSessionScore(4, "Race", 8, 0, 0, 0, 0))
        );

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
        var constructor = MakeConstructor(
            1,
            new DriverWeekendScore(2, 9, null, new DriverSessionScore(2, "Race", 18, 0, 0, 0, 0)),
            new DriverWeekendScore(3, 6, null, new DriverSessionScore(3, "Race", 10, 0, 0, 0, 0))
        );

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
