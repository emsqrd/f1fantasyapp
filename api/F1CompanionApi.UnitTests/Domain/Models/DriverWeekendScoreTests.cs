using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.UnitTests.Domain.Models;

public class DriverWeekendScoreTests
{
    private static int Qualifying(int points) => points;

    private static DriverSessionScore Session(
        string name,
        int positionPoints,
        int positionChange = 0
    ) => new(1, name, positionPoints, positionChange, 0, 0, 0);

    [Fact]
    public void RawTotal_SumsAllSessionTotals()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: Qualifying(10),
            Sprint: Session("Sprint", 8),
            Race: Session("Race", 25),
            IsCaptain: false
        );

        Assert.Equal(43, score.RawTotal);
    }

    [Fact]
    public void AdjustedTotal_DoublesWhenCaptain()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: Qualifying(10),
            Sprint: Session("Sprint", 8),
            Race: Session("Race", 25),
            IsCaptain: true
        );

        Assert.Equal(86, score.AdjustedTotal);
    }

    [Fact]
    public void AdjustedTotal_UnchangedWhenNotCaptain()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: Qualifying(10),
            Sprint: null,
            Race: Session("Race", 25),
            IsCaptain: false
        );

        Assert.Equal(35, score.AdjustedTotal);
        Assert.Equal(35, score.RawTotal);
    }

    [Fact]
    public void AdjustedQualifying_DoublesWhenCaptain()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: Qualifying(10),
            Sprint: null,
            Race: null,
            IsCaptain: true
        );

        Assert.Equal(20, score.AdjustedQualifying);
    }

    [Fact]
    public void AdjustedSprint_DoublesWhenCaptain()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: null,
            Sprint: Session("Sprint", 8),
            Race: null,
            IsCaptain: true
        );

        Assert.Equal(16, score.AdjustedSprint);
    }

    [Fact]
    public void AdjustedRace_DoublesWhenCaptain()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: null,
            Sprint: null,
            Race: Session("Race", 25),
            IsCaptain: true
        );

        Assert.Equal(50, score.AdjustedRace);
    }

    [Fact]
    public void NullSessions_ContributeZeroToRawAndAdjustedTotal()
    {
        var score = new DriverWeekendScore(
            DriverId: 1,
            Qualifying: null,
            Sprint: null,
            Race: null,
            IsCaptain: true
        );

        Assert.Equal(0, score.RawTotal);
        Assert.Equal(0, score.AdjustedTotal);
        Assert.Equal(0, score.AdjustedQualifying);
        Assert.Equal(0, score.AdjustedSprint);
        Assert.Equal(0, score.AdjustedRace);
    }
}
