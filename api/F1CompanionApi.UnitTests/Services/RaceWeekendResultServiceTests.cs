using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class RaceWeekendResultServiceTests
{
    private readonly Mock<ILogger<RaceWeekendResultService>> _mockLogger;

    public RaceWeekendResultServiceTests()
    {
        _mockLogger = new Mock<ILogger<RaceWeekendResultService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static Driver CreateDriver(int id, string abbreviation = "TST") =>
        new()
        {
            Id = id,
            FirstName = "Test",
            LastName = "Driver",
            Abbreviation = abbreviation,
            CountryAbbreviation = "GB",
        };

    private static Circuit CreateCircuit(int id) =>
        new()
        {
            Id = id,
            Name = "Circuit",
            Location = "Location",
            Country = "Country",
        };

    private static RaceWeekend CreateRace(
        int id,
        WeekendFormat weekendFormat = WeekendFormat.Standard
    ) =>
        new()
        {
            Id = id,
            SeasonId = 1,
            Round = id,
            Name = $"Race {id}",
            CircuitId = id,
            RaceDate = DateTime.UtcNow,
            WeekendFormat = weekendFormat,
        };

    private static QualifyingResultItem QualItem(
        int driverId,
        int? position,
        RacingStatus status = RacingStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            Position = position,
            Status = status,
        };

    private static RacingResultItem RaceItem(
        int driverId,
        int grid = 1,
        int? finish = 1,
        RacingStatus status = RacingStatus.Classified
    ) =>
        new()
        {
            DriverId = driverId,
            GridPosition = grid,
            FinishPosition = finish,
            Overtakes = 0,
            FastestLap = false,
            Status = status,
        };

    #region SubmitQualifyingResultsAsync

    [Fact]
    public async Task SubmitQualifyingResultsAsync_CreatesResults_WhenNoneExist()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Drivers.Add(CreateDriver(2, "HAM"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1), QualItem(2, 2)]);

        Assert.Equal(2, await context.DriverQualifyingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReplacesExistingResults()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        context.DriverQualifyingResults.Add(
            new DriverQualifyingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                Position = 5,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1)]);

        var saved = await context.DriverQualifyingResults.SingleAsync();
        Assert.Equal(1, saved.Position);
        Assert.Equal(1, await context.DriverQualifyingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsKeyNotFoundException_WhenRaceNotFound()
    {
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.SubmitQualifyingResultsAsync(99, [QualItem(1, 1)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenDuplicateDriverIds()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1), QualItem(1, 2)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenDriverNotFound()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(10, [QualItem(99, 1)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_PersistsDsqEntry_WithNullPosition()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await service.SubmitQualifyingResultsAsync(
            10,
            [QualItem(1, position: null, status: RacingStatus.DSQ)]
        );

        var saved = await context.DriverQualifyingResults.SingleAsync();
        Assert.Null(saved.Position);
        Assert.Equal(RacingStatus.DSQ, saved.Status);
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenClassifiedHasNullPosition()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(
                10,
                [QualItem(1, position: null, status: RacingStatus.Classified)]
            )
        );
    }

    [Theory]
    [InlineData(RacingStatus.DNF)]
    [InlineData(RacingStatus.DSQ)]
    [InlineData(RacingStatus.DNS)]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenNonClassifiedHasPosition(
        RacingStatus status
    )
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(10, [QualItem(1, position: 5, status: status)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReturnsEmpty_WhenEmptyBatch()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = await service.SubmitQualifyingResultsAsync(10, []);

        Assert.Empty(result);
    }

    #endregion

    #region SubmitRaceResultsAsync

    [Fact]
    public async Task SubmitRaceResultsAsync_CreatesResults_WhenNoneExist()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await service.SubmitRaceResultsAsync(
            10,
            SessionType.GrandPrix,
            [RaceItem(1, grid: 1, finish: 1)]
        );

        Assert.Equal(1, await context.DriverRacingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ReplacesExistingResults()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        context.DriverRacingResults.Add(
            new DriverRacingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                SessionType = SessionType.GrandPrix,
                GridPosition = 5,
                FinishPosition = 3,
                Overtakes = 2,
                FastestLap = false,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await service.SubmitRaceResultsAsync(
            10,
            SessionType.GrandPrix,
            [RaceItem(1, grid: 1, finish: 1)]
        );

        var saved = await context.DriverRacingResults.SingleAsync();
        Assert.Equal(1, saved.GridPosition);
        Assert.Equal(1, saved.FinishPosition);
        Assert.Equal(1, await context.DriverRacingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsKeyNotFoundException_WhenRaceNotFound()
    {
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.SubmitRaceResultsAsync(99, SessionType.GrandPrix, [RaceItem(1)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsSprintNotAvailableException_WhenRaceHasNoSprint()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<SprintNotAvailableException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.Sprint, [RaceItem(1)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_AllowsSprint_WhenRaceHasSprint()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10, WeekendFormat.Sprint));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = await service.SubmitRaceResultsAsync(
            10,
            SessionType.Sprint,
            [RaceItem(1, grid: 1, finish: 1)]
        );

        Assert.Single(result);
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenDuplicateDriverIds()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.GrandPrix,
                [RaceItem(1, grid: 1, finish: 1), RaceItem(1, grid: 2, finish: 2)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenDriverNotFound()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.GrandPrix, [RaceItem(99)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenMultipleFastestLaps()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var items = new List<RacingResultItem>
        {
            new()
            {
                DriverId = 1,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RacingStatus.Classified,
            },
            new()
            {
                DriverId = 2,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = true,
                Status = RacingStatus.Classified,
            },
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.GrandPrix, items)
        );
    }

    [Theory]
    [InlineData(RacingStatus.DNF)]
    [InlineData(RacingStatus.DSQ)]
    [InlineData(RacingStatus.DNS)]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenFinishPositionSetForNonClassified(
        RacingStatus status
    )
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.GrandPrix,
                [RaceItem(1, grid: 1, finish: 1, status: status)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenFinishPositionNullForClassified()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.GrandPrix,
                [RaceItem(1, grid: 1, finish: null, status: RacingStatus.Classified)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ReturnsEmpty_WhenEmptyBatch()
    {
        using var context = CreateInMemoryContext();
        context.Circuits.Add(CreateCircuit(10));
        context.RaceWeekends.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = await service.SubmitRaceResultsAsync(10, SessionType.GrandPrix, []);

        Assert.Empty(result);
    }

    #endregion

    #region GetQualifyingResultsAsync

    [Fact]
    public async Task GetQualifyingResultsAsync_ReturnsResults_OrderedByPosition()
    {
        using var context = CreateInMemoryContext();
        context.DriverQualifyingResults.AddRange(
            new DriverQualifyingResult
            {
                DriverId = 2,
                RaceWeekendId = 10,
                Position = 2,
                Status = RacingStatus.Classified,
            },
            new DriverQualifyingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                Position = 1,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = (await service.GetQualifyingResultsAsync(10)).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(1, result[0].Position);
        Assert.Equal(2, result[1].Position);
    }

    [Fact]
    public async Task GetQualifyingResultsAsync_ReturnsOnlyResultsForSpecifiedRace()
    {
        using var context = CreateInMemoryContext();
        context.DriverQualifyingResults.AddRange(
            new DriverQualifyingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                Position = 1,
                Status = RacingStatus.Classified,
            },
            new DriverQualifyingResult
            {
                DriverId = 1,
                RaceWeekendId = 11,
                Position = 3,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = (await service.GetQualifyingResultsAsync(10)).ToList();

        Assert.Single(result);
        Assert.Equal(10, result[0].RaceWeekendId);
    }

    #endregion

    #region GetRaceResultsAsync

    [Fact]
    public async Task GetRaceResultsAsync_ReturnsResults_OrderedByFinishPosition()
    {
        using var context = CreateInMemoryContext();
        context.DriverRacingResults.AddRange(
            new DriverRacingResult
            {
                DriverId = 2,
                RaceWeekendId = 10,
                SessionType = SessionType.GrandPrix,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
            new DriverRacingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                SessionType = SessionType.GrandPrix,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = (await service.GetRaceResultsAsync(10, SessionType.GrandPrix)).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(1, result[0].FinishPosition);
        Assert.Equal(2, result[1].FinishPosition);
    }

    [Fact]
    public async Task GetRaceResultsAsync_ReturnsOnlyResultsForSpecifiedSessionType()
    {
        using var context = CreateInMemoryContext();
        context.DriverRacingResults.AddRange(
            new DriverRacingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                SessionType = SessionType.GrandPrix,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
            new DriverRacingResult
            {
                DriverId = 1,
                RaceWeekendId = 10,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = false,
                Status = RacingStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceWeekendResultService(context, _mockLogger.Object);

        var result = (await service.GetRaceResultsAsync(10, SessionType.GrandPrix)).ToList();

        Assert.Single(result);
        Assert.Equal(SessionType.GrandPrix, result[0].SessionType);
    }

    #endregion
}
