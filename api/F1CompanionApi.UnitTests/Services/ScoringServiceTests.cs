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

    private ScoringService CreateService() =>
        new(CreateInMemoryContext(), Mock.Of<ILeagueStandingsService>(), _mockLogger.Object);

    private ScoringService CreateServiceWithContext(ApplicationDbContext context) =>
        new(context, Mock.Of<ILeagueStandingsService>(), _mockLogger.Object);

    private static Circuit SeedCircuit(int id) =>
        new()
        {
            Id = id,
            Name = "Test Circuit",
            Location = "Test",
            Country = "Test Country",
        };

    private static RaceWeekend SeedRace(int id = 1, int seasonId = 1) =>
        new()
        {
            Id = id,
            SeasonId = seasonId,
            Round = 1,
            Name = "Test GP",
            CircuitId = id,
            RaceDate = new DateTime(2025, 3, 1),
        };

    private static LineupEntry SeedLineupEntry(
        int teamId,
        int raceWeekendId,
        int entityId,
        LineupEntityType type,
        bool isCaptain = false,
        int slotPosition = 1
    ) =>
        new()
        {
            TeamId = teamId,
            RaceWeekendId = raceWeekendId,
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

    private static DriverQualifyingResult QualResult(
        int driverId,
        int? position,
        RacingStatus status = RacingStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            RaceWeekendId = 1,
            Position = position,
            Status = status,
        };

    private static DriverRacingResult RaceResult(
        int driverId = 1,
        int grid = 1,
        int? finish = 1,
        int overtakes = 0,
        bool fastestLap = false,
        RacingStatus status = RacingStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            RaceWeekendId = 1,
            SessionType = SessionType.GrandPrix,
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

    [Fact]
    public void CalculateDriverQualifyingPoints_NullPosition_Returns0()
    {
        var service = CreateService();
        Assert.Equal(
            0,
            service.CalculateDriverQualifyingPoints(
                QualResult(1, position: null, status: RacingStatus.DSQ)
            )
        );
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
            RaceResult(grid: 3, finish: null, status: RacingStatus.DNF)
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
            RaceResult(grid: 5, finish: null, overtakes: 3, status: RacingStatus.DNF)
        );
        Assert.Equal(3, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverSprintPoints_FastestLapWithDnf_TotalIsMinus3()
    {
        var service = CreateService();
        var result = service.CalculateDriverSprintPoints(
            RaceResult(finish: null, fastestLap: true, status: RacingStatus.DNF)
        );
        Assert.Equal(-3, result.Total);
    }

    #endregion

    #region CalculateDriverGrandPrixPoints

    [Fact]
    public void CalculateDriverGrandPrixPoints_P1Classified_Returns25PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 1, finish: 1));
        Assert.Equal(25, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_P10Classified_Returns1PositionPoint()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 10, finish: 10));
        Assert.Equal(1, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_P11Classified_Returns0PositionPoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 11, finish: 11));
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_PositionGain_ReturnsPositiveChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 12, finish: 6));
        Assert.Equal(6, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_PositionLoss_ReturnsNegativeChangePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 5, finish: 8));
        Assert.Equal(-3, result.PositionChangePoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_WithOvertakes_IncludesOvertakePoints()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(overtakes: 4));
        Assert.Equal(4, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_FastestLap_Adds3Points()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(fastestLap: true));
        Assert.Equal(3, result.FastestLapPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_Dnf_AppliesMinus10PenaltyAndZeroPositionChange()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(
            RaceResult(grid: 3, finish: null, status: RacingStatus.DNF)
        );
        Assert.Equal(-10, result.PenaltyPoints);
        Assert.Equal(0, result.PositionChangePoints);
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_Dsq_AppliesMinus10PenaltyAndZeroPositionChange()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(
            RaceResult(grid: 3, finish: null, status: RacingStatus.DSQ)
        );
        Assert.Equal(-10, result.PenaltyPoints);
        Assert.Equal(0, result.PositionChangePoints);
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_Dns_AppliesMinus10PenaltyAndZeroPositionChange()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(
            RaceResult(grid: 3, finish: null, status: RacingStatus.DNS)
        );
        Assert.Equal(-10, result.PenaltyPoints);
        Assert.Equal(0, result.PositionChangePoints);
        Assert.Equal(0, result.PositionPoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_DnfWithOvertakes_OvertakesStillCounted()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(
            RaceResult(grid: 5, finish: null, overtakes: 2, status: RacingStatus.DNF)
        );
        Assert.Equal(2, result.OvertakePoints);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_FastestLapWithDnf_TotalIsMinus7()
    {
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(
            RaceResult(finish: null, fastestLap: true, status: RacingStatus.DNF)
        );
        Assert.Equal(-7, result.Total);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_DominantDriver_Returns25()
    {
        // Worked example: P1 race, P1 grid → 25 position pts + 0 change = 25 (qualifying adds 10, weekend total = 35)
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 1, finish: 1));
        Assert.Equal(25, result.Total);
    }

    [Fact]
    public void CalculateDriverGrandPrixPoints_MidfieldMover_Returns14()
    {
        // Worked example: P6 race, P12 grid → 8 position pts + 6 change = 14 (qualifying adds 0, weekend total = 14)
        var service = CreateService();
        var result = service.CalculateDriverGrandPrixPoints(RaceResult(grid: 12, finish: 6));
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
            1,
            QualResult(1, 2),
            null,
            RaceResult(grid: 2, finish: 2)
        );
        Assert.Equal(9, result.Qualifying);
        Assert.Equal(18, result.GrandPrix!.Total);
        Assert.Equal(27, result.TotalPoints);
    }

    [Fact]
    public void CalculateDriverWeekendPoints_NullSprint_ZeroSprintContribution()
    {
        var service = CreateService();
        var result = service.CalculateDriverWeekendPoints(
            1,
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
            1,
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
            1,
            null,
            RaceResult(grid: 1, finish: 1),
            null
        );
        Assert.Equal(8, result.Sprint!.Total);
        Assert.Null(result.Qualifying);
        Assert.Null(result.GrandPrix);
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
            1,
            QualResult(1, 1),
            null,
            RaceResult(driverId: 1, grid: 1, finish: 1)
        );
        var driver2 = service.CalculateDriverWeekendPoints(
            2,
            QualResult(2, 5),
            null,
            RaceResult(driverId: 2, grid: 5, finish: 5)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driver1, driver2);
        Assert.Equal(16, result.QualifyingTotal);
        Assert.Equal(35, result.GrandPrixTotal);
    }

    [Fact]
    public void CalculateConstructorWeekendPoints_McLarenExample_Returns43()
    {
        // McLaren: Driver A Q2/P2 (9+18=27), Driver B Q5/P5 (6+10=16) → 43
        var service = CreateService();
        var driverA = service.CalculateDriverWeekendPoints(
            1,
            QualResult(1, 2),
            null,
            RaceResult(driverId: 1, grid: 2, finish: 2)
        );
        var driverB = service.CalculateDriverWeekendPoints(
            2,
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
            1,
            null,
            null,
            RaceResult(driverId: 1, grid: 1, finish: 1)
        );
        var driver2 = service.CalculateDriverWeekendPoints(
            2,
            null,
            null,
            RaceResult(driverId: 2, finish: null, status: RacingStatus.DNF)
        );
        var result = service.CalculateConstructorWeekendPoints(1, driver1, driver2);
        Assert.Equal(15, result.GrandPrixTotal);
    }

    #endregion

    #region ScoreRaceEntitiesAsync

    private static DriverRacingResult SprintResult(
        int driverId = 1,
        int grid = 1,
        int? finish = 1,
        int overtakes = 0,
        bool fastestLap = false,
        RacingStatus status = RacingStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            RaceWeekendId = 1,
            SessionType = SessionType.Sprint,
            GridPosition = grid,
            FinishPosition = finish,
            Overtakes = overtakes,
            FastestLap = fastestLap,
            Status = status,
        };

    [Fact]
    public async Task ScoreRaceEntitiesAsync_StandardWeekend_PersistsDriverRaceScorePerDriver()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        // Driver 1: Q1 (10 pts), Race P1 from grid 1 (25 pts, 0 change)
        // Driver 2: Q5 (6 pts), Race P5 from grid 5 (10 pts, 0 change)
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 2, position: 5));
        context.DriverRacingResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 2, grid: 5, finish: 5));
        await context.SaveChangesAsync();

        await service.ScoreRaceEntitiesAsync(race);

        var scores = await context.DriverRaceWeekendScores.ToListAsync();
        Assert.Equal(2, scores.Count);

        var d1 = scores.Single(s => s.DriverId == 1);
        Assert.Equal(10, d1.QualifyingPositionPoints);
        Assert.Equal(25, d1.GrandPrixPositionPoints);
        Assert.Equal(0, d1.GrandPrixPositionChangePoints);
        Assert.Equal(35, d1.TotalPoints);
        Assert.Null(d1.SprintTotal);

        var d2 = scores.Single(s => s.DriverId == 2);
        Assert.Equal(6, d2.QualifyingPositionPoints);
        Assert.Equal(10, d2.GrandPrixPositionPoints);
        Assert.Equal(16, d2.TotalPoints);
        Assert.Null(d2.SprintTotal);
    }

    [Fact]
    public async Task ScoreRaceEntitiesAsync_SprintWeekend_SprintComponentsPopulated()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1)); // 10 pts
        context.DriverRacingResults.Add(SprintResult(driverId: 1, grid: 1, finish: 1)); // 8 pts
        context.DriverRacingResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1)); // 25 pts
        await context.SaveChangesAsync();

        await service.ScoreRaceEntitiesAsync(race);

        var score = await context.DriverRaceWeekendScores.SingleAsync();
        Assert.Equal(8, score.SprintPositionPoints);
        Assert.Equal(0, score.SprintPositionChangePoints);
        Assert.Equal(8, score.SprintTotal);
        Assert.Equal(25, score.GrandPrixTotal);
        Assert.Equal(43, score.TotalPoints);
    }

    [Fact]
    public async Task ScoreRaceEntitiesAsync_ConstructorScores_ComponentsAggregatedAcrossDrivers()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));
        // Driver 3: Q1 (10 pts), Race P1 from grid 1 (25 pts)
        // Driver 4: Q5 (6 pts), Race P5 from grid 5 (10 pts)
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 5));
        context.DriverRacingResults.Add(RaceResult(driverId: 3, grid: 1, finish: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 4, grid: 5, finish: 5));
        await context.SaveChangesAsync();

        await service.ScoreRaceEntitiesAsync(race);

        var ctor = await context.ConstructorRaceWeekendScores.SingleAsync();
        Assert.Equal(10, ctor.ConstructorId);
        Assert.Equal(16, ctor.QualifyingPositionPoints); // 10 + 6
        Assert.Equal(35, ctor.GrandPrixPositionPoints); // 25 + 10
        Assert.Equal(51, ctor.TotalPoints); // 16 + 35
        Assert.Null(ctor.SprintTotal);
    }

    [Fact]
    public async Task ScoreRaceEntitiesAsync_ConstructorMissingDriverResults_Throws()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        // Constructor 10 has 2 active drivers but only 1 has results
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10, isActive: true));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10, isActive: true));
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 3, grid: 1, finish: 1));
        // Driver 4 has no results
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ScoreRaceEntitiesAsync(race)
        );
        Assert.Contains("Constructor 10", ex.Message);
        Assert.Contains("race 1", ex.Message);
    }

    [Fact]
    public async Task ScoreRaceWeekendAsync_RaceNotFound_Throws()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.ScoreRaceWeekendAsync(raceWeekendId: 999)
        );
        Assert.Contains("Race 999", ex.Message);
    }

    [Fact]
    public async Task ScoreRaceEntitiesAsync_CalledTwice_ReplacesExistingScores()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 1, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 2, constructorId: 10));
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 2, position: 5));
        context.DriverRacingResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 2, grid: 5, finish: 5));
        await context.SaveChangesAsync();

        await service.ScoreRaceEntitiesAsync(race);
        await service.ScoreRaceEntitiesAsync(race);

        Assert.Equal(2, await context.DriverRaceWeekendScores.CountAsync());
        Assert.Equal(1, await context.ConstructorRaceWeekendScores.CountAsync());
    }

    [Fact]
    public async Task ScoreRaceEntitiesAsync_ConstructorSprintWeekend_SprintComponentsAggregated()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 3, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 4, constructorId: 10));
        // Driver 3: Q1 (10 pts), Sprint P1 (8 pts), Race P1 (25 pts) → 43
        // Driver 4: Q5 (6 pts), Sprint P5 (4 pts), Race P5 (10 pts) → 20
        context.DriverQualifyingResults.Add(QualResult(driverId: 3, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 4, position: 5));
        context.DriverRacingResults.Add(SprintResult(driverId: 3, grid: 1, finish: 1));
        context.DriverRacingResults.Add(SprintResult(driverId: 4, grid: 5, finish: 5));
        context.DriverRacingResults.Add(RaceResult(driverId: 3, grid: 1, finish: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 4, grid: 5, finish: 5));
        await context.SaveChangesAsync();

        await service.ScoreRaceEntitiesAsync(race);

        var ctor = await context.ConstructorRaceWeekendScores.SingleAsync();
        Assert.Equal(12, ctor.SprintPositionPoints); // 8 + 4
        Assert.Equal(12, ctor.SprintTotal); // 8 + 4
        Assert.Equal(63, ctor.TotalPoints); // 16 + 12 + 35
    }

    #endregion

    #region ScoreTeamsForRaceAsync

    private static DriverRaceWeekendScore SeedDriverRaceScore(
        int driverId,
        int raceWeekendId,
        int totalPoints
    ) =>
        new()
        {
            DriverId = driverId,
            RaceWeekendId = raceWeekendId,
            TotalPoints = totalPoints,
            CalculatedAt = DateTime.UtcNow,
        };

    private static ConstructorRaceWeekendScore SeedConstructorRaceWeekendScore(
        int constructorId,
        int raceWeekendId,
        int totalPoints
    ) =>
        new()
        {
            ConstructorId = constructorId,
            RaceWeekendId = raceWeekendId,
            TotalPoints = totalPoints,
            CalculatedAt = DateTime.UtcNow,
        };

    [Fact]
    public async Task ScoreTeamsForRaceAsync_SingleDriverEntry_PersistsCorrectTotal()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);
        var race = SeedRace();

        context.DriverRaceWeekendScores.Add(
            SeedDriverRaceScore(driverId: 1, raceWeekendId: 1, totalPoints: 35)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceWeekendId: 1, entityId: 1, LineupEntityType.Driver)
        );
        await context.SaveChangesAsync();

        await service.ScoreTeamsForRaceAsync(race);

        var score = await context.TeamRaceWeekendScores.SingleAsync();
        Assert.Equal(1, score.TeamId);
        Assert.Equal(35, score.TotalPoints);
    }

    [Fact]
    public async Task ScoreTeamsForRaceAsync_CaptainDriver_DoublesPoints()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);
        var race = SeedRace();

        context.DriverRaceWeekendScores.Add(
            SeedDriverRaceScore(driverId: 1, raceWeekendId: 1, totalPoints: 35)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceWeekendId: 1,
                entityId: 1,
                LineupEntityType.Driver,
                isCaptain: true
            )
        );
        await context.SaveChangesAsync();

        await service.ScoreTeamsForRaceAsync(race);

        var score = await context.TeamRaceWeekendScores.SingleAsync();
        Assert.Equal(70, score.TotalPoints);
    }

    [Fact]
    public async Task ScoreTeamsForRaceAsync_MultipleTeams_AllTeamsScored()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);
        var race = SeedRace();

        context.DriverRaceWeekendScores.Add(
            SeedDriverRaceScore(driverId: 1, raceWeekendId: 1, totalPoints: 35)
        );
        context.DriverRaceWeekendScores.Add(
            SeedDriverRaceScore(driverId: 2, raceWeekendId: 1, totalPoints: 20)
        );
        context.ConstructorRaceWeekendScores.Add(
            SeedConstructorRaceWeekendScore(constructorId: 10, raceWeekendId: 1, totalPoints: 51)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceWeekendId: 1, entityId: 1, LineupEntityType.Driver)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceWeekendId: 1,
                entityId: 10,
                LineupEntityType.Constructor,
                slotPosition: 2
            )
        );
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 2, raceWeekendId: 1, entityId: 2, LineupEntityType.Driver)
        );
        await context.SaveChangesAsync();

        await service.ScoreTeamsForRaceAsync(race);

        var scores = await context.TeamRaceWeekendScores.ToListAsync();
        Assert.Equal(2, scores.Count);
        Assert.Equal(86, scores.Single(s => s.TeamId == 1).TotalPoints); // 35 + 51
        Assert.Equal(20, scores.Single(s => s.TeamId == 2).TotalPoints);
    }

    [Fact]
    public async Task ScoreTeamsForRaceAsync_MissingEntityScore_TreatsAsZeroPoints()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);
        var race = SeedRace();

        // No DriverRaceScore exists for driver 99
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceWeekendId: 1, entityId: 99, LineupEntityType.Driver)
        );
        await context.SaveChangesAsync();

        await service.ScoreTeamsForRaceAsync(race);

        var score = await context.TeamRaceWeekendScores.SingleAsync();
        Assert.Equal(0, score.TotalPoints);
    }

    [Fact]
    public async Task ScoreTeamsForRaceAsync_CalledTwice_ReplacesExistingTeamScores()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);
        var race = SeedRace();

        context.DriverRaceWeekendScores.Add(
            SeedDriverRaceScore(driverId: 1, raceWeekendId: 1, totalPoints: 35)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceWeekendId: 1, entityId: 1, LineupEntityType.Driver)
        );
        await context.SaveChangesAsync();

        await service.ScoreTeamsForRaceAsync(race);
        await service.ScoreTeamsForRaceAsync(race);

        Assert.Equal(1, await context.TeamRaceWeekendScores.CountAsync());
    }

    #endregion

    #region ScoreRaceWeekendAsync

    [Fact]
    public async Task ScoreRaceWeekendAsync_HappyPath_ScoresEntitiesAndTeams()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 1, constructorId: 10));
        context.SeasonDrivers.Add(SeedSeasonDriver(driverId: 2, constructorId: 10));
        context.DriverQualifyingResults.Add(QualResult(driverId: 1, position: 1));
        context.DriverQualifyingResults.Add(QualResult(driverId: 2, position: 5));
        context.DriverRacingResults.Add(RaceResult(driverId: 1, grid: 1, finish: 1));
        context.DriverRacingResults.Add(RaceResult(driverId: 2, grid: 5, finish: 5));
        context.LineupEntries.Add(
            SeedLineupEntry(teamId: 1, raceWeekendId: 1, entityId: 1, LineupEntityType.Driver)
        );
        context.LineupEntries.Add(
            SeedLineupEntry(
                teamId: 1,
                raceWeekendId: 1,
                entityId: 10,
                LineupEntityType.Constructor,
                slotPosition: 2
            )
        );
        await context.SaveChangesAsync();

        await service.ScoreRaceWeekendAsync(raceWeekendId: 1);

        Assert.Equal(2, await context.DriverRaceWeekendScores.CountAsync());
        Assert.Equal(1, await context.ConstructorRaceWeekendScores.CountAsync());
        Assert.Equal(1, await context.TeamRaceWeekendScores.CountAsync());
    }

    [Fact]
    public async Task ScoreRaceWeekendAsync_HappyPath_SetsScoredAtOnRaceWeekend()
    {
        var context = CreateInMemoryContext();
        var service = CreateServiceWithContext(context);

        context.Circuits.Add(SeedCircuit(1));
        var race = SeedRace(id: 1, seasonId: 1);
        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        var beforeUtc = DateTime.UtcNow;
        await service.ScoreRaceWeekendAsync(raceWeekendId: 1);
        var afterUtc = DateTime.UtcNow;

        var weekend = await context.RaceWeekends.FindAsync(1);
        Assert.NotNull(weekend);
        Assert.NotNull(weekend!.ScoredAt);
        Assert.InRange(weekend.ScoredAt!.Value, beforeUtc, afterUtc);
    }

    #endregion
}
