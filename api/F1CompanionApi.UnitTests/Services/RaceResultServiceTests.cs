using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class RaceResultServiceTests
{
    private readonly Mock<ILogger<RaceResultService>> _mockLogger;

    public RaceResultServiceTests()
    {
        _mockLogger = new Mock<ILogger<RaceResultService>>();
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

    private static SeasonRace CreateRace(int id, bool hasSprint = false) =>
        new()
        {
            Id = id,
            SeasonId = 1,
            Round = id,
            Name = $"Race {id}",
            CircuitId = 1,
            RaceDate = DateTime.UtcNow,
            HasSprint = hasSprint,
        };

    private static QualifyingResultItem QualItem(int driverId, int position) =>
        new() { DriverId = driverId, Position = position };

    private static RaceResultItem RaceItem(
        int driverId,
        int grid = 1,
        int? finish = 1,
        RaceStatus status = RaceStatus.Classified
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
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1), QualItem(2, 2)]);

        Assert.Equal(2, await context.DriverQualifyingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReplacesExistingResults()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.SeasonRaces.Add(CreateRace(10));
        context.DriverQualifyingResults.Add(
            new DriverQualifyingResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                Position = 5,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1)]);

        var saved = await context.DriverQualifyingResults.SingleAsync();
        Assert.Equal(1, saved.Position);
        Assert.Equal(1, await context.DriverQualifyingResults.CountAsync());
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsKeyNotFoundException_WhenRaceNotFound()
    {
        using var context = CreateInMemoryContext();
        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.SubmitQualifyingResultsAsync(99, [QualItem(1, 1)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenDuplicateDriverIds()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(10, [QualItem(1, 1), QualItem(1, 2)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ThrowsArgumentException_WhenDriverNotFound()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitQualifyingResultsAsync(10, [QualItem(99, 1)])
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReturnsEmpty_WhenEmptyBatch()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

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
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await service.SubmitRaceResultsAsync(
            10,
            SessionType.Race,
            [RaceItem(1, grid: 1, finish: 1)]
        );

        Assert.Equal(1, await context.DriverRaceResults.CountAsync());
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ReplacesExistingResults()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.SeasonRaces.Add(CreateRace(10));
        context.DriverRaceResults.Add(
            new DriverRaceResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                SessionType = SessionType.Race,
                GridPosition = 5,
                FinishPosition = 3,
                Overtakes = 2,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await service.SubmitRaceResultsAsync(
            10,
            SessionType.Race,
            [RaceItem(1, grid: 1, finish: 1)]
        );

        var saved = await context.DriverRaceResults.SingleAsync();
        Assert.Equal(1, saved.GridPosition);
        Assert.Equal(1, saved.FinishPosition);
        Assert.Equal(1, await context.DriverRaceResults.CountAsync());
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsKeyNotFoundException_WhenRaceNotFound()
    {
        using var context = CreateInMemoryContext();
        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            service.SubmitRaceResultsAsync(99, SessionType.Race, [RaceItem(1)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsSprintNotAvailableException_WhenRaceHasNoSprint()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10, hasSprint: false));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<SprintNotAvailableException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.Sprint, [RaceItem(1)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_AllowsSprint_WhenRaceHasSprint()
    {
        using var context = CreateInMemoryContext();
        context.Drivers.Add(CreateDriver(1, "VER"));
        context.SeasonRaces.Add(CreateRace(10, hasSprint: true));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

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
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.Race,
                [RaceItem(1, grid: 1, finish: 1), RaceItem(1, grid: 2, finish: 2)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenDriverNotFound()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.Race, [RaceItem(99)])
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenMultipleFastestLaps()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        var items = new List<RaceResultItem>
        {
            new()
            {
                DriverId = 1,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RaceStatus.Classified,
            },
            new()
            {
                DriverId = 2,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = true,
                Status = RaceStatus.Classified,
            },
        };

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(10, SessionType.Race, items)
        );
    }

    [Theory]
    [InlineData(RaceStatus.DNF)]
    [InlineData(RaceStatus.DSQ)]
    [InlineData(RaceStatus.DNS)]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenFinishPositionSetForNonClassified(
        RaceStatus status
    )
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.Race,
                [RaceItem(1, grid: 1, finish: 1, status: status)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ThrowsArgumentException_WhenFinishPositionNullForClassified()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SubmitRaceResultsAsync(
                10,
                SessionType.Race,
                [RaceItem(1, grid: 1, finish: null, status: RaceStatus.Classified)]
            )
        );
    }

    [Fact]
    public async Task SubmitRaceResultsAsync_ReturnsEmpty_WhenEmptyBatch()
    {
        using var context = CreateInMemoryContext();
        context.SeasonRaces.Add(CreateRace(10));
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        var result = await service.SubmitRaceResultsAsync(10, SessionType.Race, []);

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
                SeasonRaceId = 10,
                Position = 2,
            },
            new DriverQualifyingResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                Position = 1,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

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
                SeasonRaceId = 10,
                Position = 1,
            },
            new DriverQualifyingResult
            {
                DriverId = 1,
                SeasonRaceId = 11,
                Position = 3,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        var result = (await service.GetQualifyingResultsAsync(10)).ToList();

        Assert.Single(result);
        Assert.Equal(10, result[0].RaceId);
    }

    #endregion

    #region GetRaceResultsAsync

    [Fact]
    public async Task GetRaceResultsAsync_ReturnsResults_OrderedByFinishPosition()
    {
        using var context = CreateInMemoryContext();
        context.DriverRaceResults.AddRange(
            new DriverRaceResult
            {
                DriverId = 2,
                SeasonRaceId = 10,
                SessionType = SessionType.Race,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
            new DriverRaceResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                SessionType = SessionType.Race,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RaceStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        var result = (await service.GetRaceResultsAsync(10, SessionType.Race)).ToList();

        Assert.Equal(2, result.Count);
        Assert.Equal(1, result[0].FinishPosition);
        Assert.Equal(2, result[1].FinishPosition);
    }

    [Fact]
    public async Task GetRaceResultsAsync_ReturnsOnlyResultsForSpecifiedSessionType()
    {
        using var context = CreateInMemoryContext();
        context.DriverRaceResults.AddRange(
            new DriverRaceResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                SessionType = SessionType.Race,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
            new DriverRaceResult
            {
                DriverId = 1,
                SeasonRaceId = 10,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 0,
                FastestLap = false,
                Status = RaceStatus.Classified,
            }
        );
        await context.SaveChangesAsync();

        var service = new RaceResultService(context, _mockLogger.Object);

        var result = (await service.GetRaceResultsAsync(10, SessionType.Race)).ToList();

        Assert.Single(result);
        Assert.Equal(SessionType.Race, result[0].SessionType);
    }

    #endregion
}
