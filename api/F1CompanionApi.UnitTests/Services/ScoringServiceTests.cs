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

    private ScoringService CreateServiceWithContext(ApplicationDbContext context) =>
        new(context, _mockLogger.Object);

    private static Race SeedRace(int id = 1, int seasonId = 1) =>
        new()
        {
            Id = id,
            SeasonId = seasonId,
            Round = 1,
            Name = "Test GP",
            Location = "Test",
            Circuit = "Test Circuit",
            Country = "Test Country",
            RaceDate = new DateTime(2025, 3, 1),
        };

    private static LineupEntry SeedLineupEntry(
        int teamId,
        int raceId,
        int entityId,
        LineupEntityType type,
        bool isCaptain = false,
        int slotPosition = 1
    ) =>
        new()
        {
            TeamId = teamId,
            RaceId = raceId,
            EntityId = entityId,
            EntityType = type,
            SlotPosition = slotPosition,
            IsCaptain = isCaptain,
        };

    private static SeasonDriver SeedSeasonDriver(
        int driverId,
        int constructorId,
        int seasonId = 1,
        bool isActive = true
    ) =>
        new()
        {
            SeasonId = seasonId,
            DriverId = driverId,
            ConstructorId = constructorId,
            IsActive = isActive,
        };

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

    #region CalculateDriverWeekendPoints

    [Fact]
    public void CalculateDriverWeekendPoints_StandardWeekend_SumsAllSessions()
    {
        var service = CreateService();
        // P2 quali (9), P2 race from grid 2 (18 pts, 0 change)
        var result = service.CalculateDriverWeekendPoints(
            QualResult(1, 2),
            null,
            RaceResult(grid: 2, finish: 2)
        );
        Assert.Equal(9, result.Qualifying);
        Assert.Equal(18, result.Race!.Total);
        Assert.Equal(27, result.TotalPoints);
    }

    [Fact]
    public void CalculateDriverWeekendPoints_NullSprint_ZeroSprintContribution()
    {
        var service = CreateService();
        var result = service.CalculateDriverWeekendPoints(
            QualResult(1, 1),
            null,
            RaceResult(grid: 1, finish: 1)
        );
        Assert.Null(result.Sprint);
    }

    [Fact]
    public void CalculateDriverWeekendPoints_NullQualifying_ZeroQualifyingContribution()
    {
        var service = CreateService();
        var result = service.CalculateDriverWeekendPoints(
            null,
            null,
            RaceResult(grid: 1, finish: 1)
        );
        Assert.Null(result.Qualifying);
    }

    [Fact]
    public void CalculateDriverWeekendPoints_SprintOnlyPartialWeekend_OnlySprintPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverWeekendPoints(
            null,
            RaceResult(grid: 1, finish: 1),
            null
        );
        Assert.Equal(8, result.Sprint!.Total);
        Assert.Null(result.Qualifying);
        Assert.Null(result.Race);
    }

    #endregion

    #region CalculateConstructorWeekendPoints

    [Fact]
    public void CalculateConstructorWeekendPoints_PerSessionTotals_SumsBothDriversRawPoints()
    {
        var service = CreateService();
        // Driver 1: P1 quali (10), P1 race from grid 1 (25)
        // Driver 2: P5 quali (6), P5 race from grid 5 (10)
        var driver1 = service.CalculateDriverWeekendPoints(
            QualResult(1, 1),
            null,
            RaceResult(driverId: 1, grid: 1, finish: 1)
        );
        var driver2 = service.CalculateDriverWeekendPoints(
            QualResult(2, 5),
            null,
            RaceResult(driverId: 2, grid: 5, finish: 5)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driver1, driver2);
        Assert.Equal(16, result.QualifyingTotal);
        Assert.Equal(35, result.RaceTotal);
    }

    [Fact]
    public void CalculateConstructorWeekendPoints_TotalsMatchSumOfBothDrivers()
    {
        var service = CreateService();
        var driver1 = service.CalculateDriverWeekendPoints(
            QualResult(1, 1),
            null,
            RaceResult(driverId: 1, grid: 1, finish: 1)
        );
        var driver2 = service.CalculateDriverWeekendPoints(
            QualResult(2, 5),
            null,
            RaceResult(driverId: 2, grid: 5, finish: 5)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driver1, driver2);
        Assert.Equal(driver1.TotalPoints + driver2.TotalPoints, result.Total);
    }

    [Fact]
    public void CalculateConstructorWeekendPoints_McLarenExample_Returns43()
    {
        // McLaren: Driver A Q2/P2 (9+18=27), Driver B Q5/P5 (6+10=16) → 43
        var service = CreateService();
        var driverA = service.CalculateDriverWeekendPoints(
            QualResult(1, 2),
            null,
            RaceResult(driverId: 1, grid: 2, finish: 2)
        );
        var driverB = service.CalculateDriverWeekendPoints(
            QualResult(2, 5),
            null,
            RaceResult(driverId: 2, grid: 5, finish: 5)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driverA, driverB);
        Assert.Equal(43, result.Total);
    }

    [Fact]
    public void CalculateConstructorWeekendPoints_OneDriverDnf_PenaltyFlowsThroughRaceTotal()
    {
        var service = CreateService();
        // Driver 1: P1 race (25 pts)
        // Driver 2: DNF race (-10 pts)
        var driver1 = service.CalculateDriverWeekendPoints(
            null,
            null,
            RaceResult(driverId: 1, grid: 1, finish: 1)
        );
        var driver2 = service.CalculateDriverWeekendPoints(
            null,
            null,
            RaceResult(driverId: 2, finish: null, status: RaceStatus.DNF)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driver1, driver2);
        Assert.Equal(15, result.RaceTotal);
    }

    #endregion

    #region CalculateTeamRaceScoreAsync

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_StandardWeekend_ScoresAllDriverEntries()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                slotPosition: 1
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 2,
                LineupEntityType.Driver,
                slotPosition: 2
            )
        );
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 2)); // 9 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 2, position: 5)); // 6 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 2, finish: 2)); // 18 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 2, grid: 5, finish: 5)); // 10 pts
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        Assert.Equal(2, result.DriverScores.Count);
        Assert.Empty(result.ConstructorScores);
        var d1 = result.DriverScores.Single(d => d.DriverId == 1);
        var d2 = result.DriverScores.Single(d => d.DriverId == 2);
        Assert.Equal(27, d1.EntityScore.TotalPoints); // 9 + 18
        Assert.Equal(16, d2.EntityScore.TotalPoints); // 6 + 10
        Assert.Equal(43, result.TotalPoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_ConstructorEntry_PerSessionTotalsMatchDriverRawPoints()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 10, LineupEntityType.Constructor)
        );
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 1)); // 10 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 5)); // 6 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 3, grid: 1, finish: 1)); // 25 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 4, grid: 5, finish: 5)); // 10 pts
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        Assert.Single(result.ConstructorScores);
        var ctor = result.ConstructorScores.Single(c => c.ConstructorId == 10);
        Assert.Equal(16, ctor.QualifyingTotal); // 10 + 6
        Assert.Equal(35, ctor.RaceTotal); // 25 + 10
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_CaptainDriver_MultiplierReflectedInTeamTotals()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                isCaptain: true,
                slotPosition: 1
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 10,
                LineupEntityType.Constructor,
                slotPosition: 2
            )
        );
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1)); // 10 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 5)); // 6 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 10)); // 1 pt
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1)); // 25 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 3, grid: 5, finish: 5)); // 10 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 4, grid: 10, finish: 10)); // 1 pt
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        // Captain driver 1: AdjustedQualifying=20, AdjustedRace=50
        // Constructor 10: QualifyingTotal=7, RaceTotal=11
        Assert.Equal(27, result.QualifyingTotal); // 20 + 7
        Assert.Equal(61, result.RaceTotal); // 50 + 11
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_NoCaptain_NoMultiplierApplied()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                isCaptain: false
            )
        );
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1)); // 10 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1)); // 25 pts
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        var d1 = result.DriverScores.Single();
        Assert.Equal(d1.EntityScore.TotalPoints, d1.AdjustedTotal);
        Assert.Equal(35, result.TotalPoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_SprintWeekend_AllSessionTypesScored()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 1, LineupEntityType.Driver)
        );
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1)); // 10 pts
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 1,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1)); // 25 pts
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        Assert.Equal(10, result.QualifyingTotal); // 10 quali pts
        Assert.Equal(8, result.SprintTotal); // 8 sprint pts (P1)
        Assert.Equal(25, result.RaceTotal); // 25 race pts
        Assert.Equal(43, result.TotalPoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_DriverWithNoResults_ReturnsZeroPoints()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 99, LineupEntityType.Driver)
        );
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        Assert.Single(result.DriverScores);
        Assert.Equal(0, result.TotalPoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_NoQualifyingResults_PositionChangeStillScored()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 1, LineupEntityType.Driver)
        );
        // No qualifying results — position change still scored from grid position
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 5, finish: 2));
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        var d1 = result.DriverScores.Single();
        Assert.Equal(3, d1.EntityScore.Race!.PositionChangePoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_PartialWeekend_SprintOnlyIngested_OnlySprintTotalPopulated()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 1, LineupEntityType.Driver)
        );
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 1,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        Assert.Equal(0, result.QualifyingTotal);
        Assert.Equal(8, result.SprintTotal); // P1 sprint = 8
        Assert.Equal(0, result.RaceTotal);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_PerSessionTotals_CombineDriverAdjustedAndConstructorRaw()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                isCaptain: true,
                slotPosition: 1
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 10,
                LineupEntityType.Constructor,
                slotPosition: 2
            )
        );
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1)); // 10 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 3)); // 8 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 10)); // 1 pt
        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        // QualifyingTotal = driver1.AdjustedQualifying (10*2=20) + ctor.QualifyingTotal (8+1=9)
        Assert.Equal(29, result.QualifyingTotal);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_FullIntegration_MatchesHandCalculatedTotal()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        // Lineup: Driver 1 (captain), Driver 2, Constructor 10
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                isCaptain: true,
                slotPosition: 1
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 2,
                LineupEntityType.Driver,
                slotPosition: 2
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceId: 1,
                entityId: 10,
                LineupEntityType.Constructor,
                slotPosition: 3
            )
        );
        // Constructor 10 has Driver 3 and Driver 4
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));

        // Qualifying: D1 P1(10), D2 P8(3), D3 P3(8), D4 P10(1)
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 2, position: 8));
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 3));
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 10));

        // Sprint: D1 P1(8), D2 P8(1), D3 P3(6), D4 DNF(-5)
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 1,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 2,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 8,
                FinishPosition = 8,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 3,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 3,
                FinishPosition = 3,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 4,
                RaceId = 1,
                SessionType = SessionType.Sprint,
                GridPosition = 5,
                FinishPosition = null,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.DNF,
            }
        );

        // Race: D1 P1(25), D2 DNF(-10), D3 P3(15), D4 P6(8)
        context.DriverRaceResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1));
        context.DriverRaceResults.Add(
            RaceResult(driverId: 2, grid: 8, finish: null, status: RaceStatus.DNF)
        );
        context.DriverRaceResults.Add(RaceResult(driverId: 3, grid: 3, finish: 3));
        context.DriverRaceResults.Add(RaceResult(driverId: 4, grid: 6, finish: 6));

        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        // Driver 1 (captain): Q=10→20adj, Sprint=8→16adj, Race=25→50adj
        // Driver 2: Q=3, Sprint=1, Race=-10
        // Constructor 10: Q=8+1=9, Sprint=6+(-5)=1, Race=15+8=23
        Assert.Equal(32, result.QualifyingTotal); // 20 + 3 + 9
        Assert.Equal(18, result.SprintTotal); // 16 + 1 + 1
        Assert.Equal(63, result.RaceTotal); // 50 + (-10) + 23
        Assert.Equal(113, result.TotalPoints);
    }

    [Fact]
    public async Task CalculateTeamRaceScoreAsync_InactiveConstructorDriver_ExcludedFromScore()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Races.Add(SeedRace(id: 1, seasonId: 1));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceId: 1, entityId: 10, LineupEntityType.Constructor)
        );
        // Driver 3 active; Driver 5 replaced mid-season by Driver 6
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10, isActive: true));
        context.SeasonDrivers.Add(
            SeedSeasonDriver(driverId: 5, constructorId: 10, isActive: false)
        );
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 6, constructorId: 10, isActive: true));

        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 1)); // 10 pts
        context.DriverQualifyingResults.Add(QualResult(driverId: 5, position: 2)); // 9 pts — should be ignored
        context.DriverQualifyingResults.Add(QualResult(driverId: 6, position: 5)); // 6 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 3, grid: 1, finish: 1)); // 25 pts
        context.DriverRaceResults.Add(RaceResult(driverId: 5, grid: 2, finish: 2)); // 18 pts — should be ignored
        context.DriverRaceResults.Add(RaceResult(driverId: 6, grid: 5, finish: 5)); // 10 pts

        await context.SaveChangesAsync();

        var result = await service.CalculateTeamRaceScoreAsync(teamId: 1, raceId: 1);

        // Drivers 3 and 6 count; Driver 5 excluded
        Assert.Equal(16, result.QualifyingTotal); // 10 + 6
        Assert.Equal(35, result.RaceTotal); // 25 + 10
    }

    #endregion
}
