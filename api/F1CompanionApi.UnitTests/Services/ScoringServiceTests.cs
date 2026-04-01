using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class ScoringServiceTests
{
    private readonly Mock<ILogger<ScoringService>> _mockLogger;

    public ScoringServiceTests()
    {
        _mockLogger = new Mock<ILogger<ScoringService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private ScoringService CreateService() => new(CreateInMemoryContext(), _mockLogger.Object);

    private static DriverQualifyingResult QualResult(int driverId, int position) =>
        new()
        {
            DriverId = driverId,
            RaceId = 1,
            Position = position,
        };

    private static DriverRaceResult RaceResult(
        int driverId = 1,
        int grid = 1,
        int? finish = 1,
        int overtakes = 0,
        bool fastestLap = false,
        RaceStatus status = RaceStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            RaceId = 1,
            SessionType = SessionType.Race,
            GridPosition = grid,
            FinishPosition = finish,
            Overtakes = overtakes,
            FastestLap = fastestLap,
            Status = status,
        };

    #region CalculateDriverQualifyingPoints

    [Fact]
    public void CalculateDriverQualifyingPoints_P1_Returns10()
    {
        var service = CreateService();
        Assert.Equal(10, service.CalculateDriverQualifyingPoints(QualResult(1, 1)));
    }

    [Fact]
    public void CalculateDriverQualifyingPoints_P10_Returns1()
    {
        var service = CreateService();
        Assert.Equal(1, service.CalculateDriverQualifyingPoints(QualResult(1, 10)));
    }

    [Fact]
    public void CalculateDriverQualifyingPoints_P11_Returns0()
    {
        var service = CreateService();
        Assert.Equal(0, service.CalculateDriverQualifyingPoints(QualResult(1, 11)));
    }

    #endregion

    #region CalculateDriverSprintPoints

    [Fact]
    public void CalculateDriverSprintPoints_P1Classified_Returns8PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(grid: 1, finish: 1));
        Assert.Equal(8, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_P8Classified_Returns1PositionPoint()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(grid: 8, finish: 8));
        Assert.Equal(1, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_P9Classified_Returns0PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(grid: 9, finish: 9));
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_PositionGain_ReturnsPositiveChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(grid: 5, finish: 2));
        Assert.Equal(3, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_PositionLoss_ReturnsNegativeChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(grid: 2, finish: 5));
        Assert.Equal(-3, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_WithOvertakes_IncludesOvertakePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(
            RaceResult(grid: 5, finish: 3, overtakes: 2)
        );
        Assert.Equal(2, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_FastestLap_Adds2Points()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(RaceResult(fastestLap: true));
        Assert.Equal(2, result.FastestLapPoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_Dnf_AppliesMinus5PenaltyAndZeroPositionChange()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(
            RaceResult(grid: 3, finish: null, status: RaceStatus.DNF)
        );
        Assert.Equal(-5, result.PenaltyPoints);
        Assert.Equal(0, result.PositionChangePoints);
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_DnfWithOvertakes_OvertakesStillCounted()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(
            RaceResult(grid: 5, finish: null, overtakes: 3, status: RaceStatus.DNF)
        );
        Assert.Equal(3, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_FastestLapWithDnf_TotalIsMinus3()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(
            RaceResult(finish: null, fastestLap: true, status: RaceStatus.DNF)
        );
        Assert.Equal(-3, result.Total);
    }

    #endregion

    #region CalculateDriverRacePoints

    [Fact]
    public void CalculateDriverRacePoints_P1Classified_Returns25PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 1, finish: 1));
        Assert.Equal(25, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_P10Classified_Returns1PositionPoint()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 10, finish: 10));
        Assert.Equal(1, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_P11Classified_Returns0PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 11, finish: 11));
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_PositionGain_ReturnsPositiveChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 12, finish: 6));
        Assert.Equal(6, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_PositionLoss_ReturnsNegativeChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 5, finish: 8));
        Assert.Equal(-3, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_WithOvertakes_IncludesOvertakePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(overtakes: 4));
        Assert.Equal(4, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_FastestLap_Adds3Points()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(fastestLap: true));
        Assert.Equal(3, result.FastestLapPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_Dnf_AppliesMinus10PenaltyAndZeroPositionChange()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(grid: 3, finish: null, status: RaceStatus.DNF)
        );
        Assert.Equal(-10, result.PenaltyPoints);
        Assert.Equal(0, result.PositionChangePoints);
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_Dsq_AppliesMinus10Penalty()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(finish: null, status: RaceStatus.DSQ)
        );
        Assert.Equal(-10, result.PenaltyPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_Dns_AppliesMinus10Penalty()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(finish: null, status: RaceStatus.DNS)
        );
        Assert.Equal(-10, result.PenaltyPoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_DnfWithOvertakes_OvertakesStillCounted()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(grid: 5, finish: null, overtakes: 2, status: RaceStatus.DNF)
        );
        Assert.Equal(2, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_FastestLapWithDnf_TotalIsMinus7()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(finish: null, fastestLap: true, status: RaceStatus.DNF)
        );
        Assert.Equal(-7, result.Total);
    }

    [Fact]
    public void CalculateDriverRacePoints_CancelledQualifying_NoPositionChangeApplied()
    {
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(
            RaceResult(grid: 5, finish: 2),
            qualifyingOccurred: false
        );
        Assert.Equal(0, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverRacePoints_DominantDriver_Returns25()
    {
        // Worked example: P1 race, P1 grid → 25 position pts + 0 change = 25 (qualifying adds 10, weekend total = 35)
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 1, finish: 1));
        Assert.Equal(25, result.Total);
    }

    [Fact]
    public void CalculateDriverRacePoints_MidfieldMover_Returns14()
    {
        // Worked example: P6 race, P12 grid → 8 position pts + 6 change = 14 (qualifying adds 0, weekend total = 14)
        var service = CreateService();
        var result = service.CalculateDriverRacePoints(RaceResult(grid: 12, finish: 6));
        Assert.Equal(14, result.Total);
    }

    #endregion
}
