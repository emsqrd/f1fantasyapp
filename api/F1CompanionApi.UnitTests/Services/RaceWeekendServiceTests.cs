using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class RaceWeekendServiceTests
{
    private readonly Mock<ILogger<RaceWeekendService>> _mockLogger;

    public RaceWeekendServiceTests()
    {
        _mockLogger = new Mock<ILogger<RaceWeekendService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private Circuit CreateCircuit(string name, string location, string country)
    {
        return new Circuit
        {
            Name = name,
            Location = location,
            Country = country,
        };
    }

    #region GetRaceWeekendsBySeasonAsync Tests

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsAllRaceWeekends_WhenRaceWeekendsExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Bahrain International Circuit", "Sakhir", "Bahrain"),
            CreateCircuit("Jeddah Corniche Circuit", "Jeddah", "Saudi Arabia"),
            CreateCircuit("Albert Park Circuit", "Melbourne", "Australia"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "Bahrain Grand Prix",
                CircuitId = circuits[0].Id,
                RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                CircuitId = circuits[1].Id,
                RaceDate = new DateTime(2026, 3, 29, 17, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 3,
                Name = "Australian Grand Prix",
                CircuitId = circuits[2].Id,
                RaceDate = new DateTime(2026, 4, 5, 5, 0, 0, DateTimeKind.Utc),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.Count());
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsEmpty_WhenNoRaceWeekendsExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsOnlyRaceWeekends_ForSpecifiedSeason()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Circuit 1", "Location 1", "Country 1"),
            CreateCircuit("Circuit 2", "Location 2", "Country 2"),
            CreateCircuit("Circuit 3", "Location 3", "Country 3"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "2025 Race",
                CircuitId = circuits[0].Id,
                RaceDate = new DateTime(2025, 3, 2, 15, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 2,
                Round = 1,
                Name = "2026 Race 1",
                CircuitId = circuits[1].Id,
                RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 2,
                Round = 2,
                Name = "2026 Race 2",
                CircuitId = circuits[2].Id,
                RaceDate = new DateTime(2026, 3, 29, 17, 0, 0, DateTimeKind.Utc),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(2);

        // Assert
        var raceList = result.ToList();
        Assert.Equal(2, raceList.Count);
        Assert.All(raceList, rw => Assert.Equal(2, rw.SeasonId));
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsRaceWeekends_OrderedByRound()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Albert Park Circuit", "Melbourne", "Australia"),
            CreateCircuit("Bahrain International Circuit", "Sakhir", "Bahrain"),
            CreateCircuit("Jeddah Corniche Circuit", "Jeddah", "Saudi Arabia"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 3,
                Name = "Australian Grand Prix",
                CircuitId = circuits[0].Id,
                RaceDate = new DateTime(2026, 4, 5, 5, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "Bahrain Grand Prix",
                CircuitId = circuits[1].Id,
                RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                CircuitId = circuits[2].Id,
                RaceDate = new DateTime(2026, 3, 29, 17, 0, 0, DateTimeKind.Utc),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        var raceList = result.ToList();
        Assert.Equal(1, raceList[0].Round);
        Assert.Equal(2, raceList[1].Round);
        Assert.Equal(3, raceList[2].Round);
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_MarksCurrentRaceWeekend_WhenRaceIsUpcoming()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Past Circuit", "Past Location", "Past Country"),
            CreateCircuit("Current Circuit", "Current Location", "Current Country"),
            CreateCircuit("Future Circuit", "Future Location", "Future Country"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "Past Race",
                CircuitId = circuits[0].Id,
                RaceDate = now.AddDays(-10),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 2,
                Name = "Current Race",
                CircuitId = circuits[1].Id,
                RaceDate = now.AddDays(5),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 3,
                Name = "Future Race",
                CircuitId = circuits[2].Id,
                RaceDate = now.AddDays(15),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        var raceList = result.ToList();
        Assert.False(raceList[0].IsCurrent); // Past race
        Assert.True(raceList[1].IsCurrent); // First upcoming race
        Assert.False(raceList[2].IsCurrent); // Future race
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_MarksNoCurrentRaceWeekend_WhenAllRacesHavePassed()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Circuit 1", "Location 1", "Country 1"),
            CreateCircuit("Circuit 2", "Location 2", "Country 2"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "Past Race 1",
                CircuitId = circuits[0].Id,
                RaceDate = now.AddDays(-20),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 2,
                Name = "Past Race 2",
                CircuitId = circuits[1].Id,
                RaceDate = now.AddDays(-10),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        var raceList = result.ToList();
        Assert.All(raceList, rw => Assert.False(rw.IsCurrent));
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsCorrectRaceWeekendData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var raceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc);
        var lockDeadline = new DateTime(2026, 3, 22, 14, 0, 0, DateTimeKind.Utc);

        var circuit = CreateCircuit("Bahrain International Circuit", "Sakhir", "Bahrain");
        context.Circuits.Add(circuit);
        await context.SaveChangesAsync();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 1,
            Name = "Bahrain Grand Prix",
            CircuitId = circuit.Id,
            RaceDate = raceDate,
            LockDeadline = lockDeadline,
        };

        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendsBySeasonAsync(1);

        // Assert
        var raceResponse = result.Single();
        Assert.Equal(race.Id, raceResponse.Id);
        Assert.Equal(1, raceResponse.SeasonId);
        Assert.Equal(1, raceResponse.Round);
        Assert.Equal("Bahrain Grand Prix", raceResponse.Name);
        Assert.Equal("Sakhir", raceResponse.Circuit.Location);
        Assert.Equal("Bahrain International Circuit", raceResponse.Circuit.Name);
        Assert.Equal("Bahrain", raceResponse.Circuit.Country);
        Assert.Equal(raceDate, raceResponse.RaceDate);
        Assert.Equal(lockDeadline, raceResponse.LockDeadline);
    }

    #endregion

    #region GetRaceWeekendByRoundAsync Tests

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_ReturnsRaceWeekend_WhenExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuit = CreateCircuit("Bahrain International Circuit", "Sakhir", "Bahrain");
        context.Circuits.Add(circuit);
        await context.SaveChangesAsync();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 1,
            Name = "Bahrain Grand Prix",
            CircuitId = circuit.Id,
            RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
        };

        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendByRoundAsync(1, 1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(race.Id, result.Id);
        Assert.Equal("Bahrain Grand Prix", result.Name);
    }

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_ReturnsNull_WhenRoundDoesNotExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        // Act
        var result = await service.GetRaceWeekendByRoundAsync(1, 999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_ReturnsNull_WhenSeasonDoesNotMatch()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuit = CreateCircuit("Circuit 1", "Location", "Country");
        context.Circuits.Add(circuit);
        await context.SaveChangesAsync();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 1,
            Name = "Race 1",
            CircuitId = circuit.Id,
            RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
        };

        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        // Act — query for season 2, which has no races
        var result = await service.GetRaceWeekendByRoundAsync(2, 1);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_MarksRaceAsCurrent_WhenRaceIsNextUpcoming()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuits = new[]
        {
            CreateCircuit("Circuit 1", "Location 1", "Country 1"),
            CreateCircuit("Circuit 2", "Location 2", "Country 2"),
        };
        context.Circuits.AddRange(circuits);
        await context.SaveChangesAsync();

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 1,
                Name = "Past Race",
                CircuitId = circuits[0].Id,
                RaceDate = now.AddDays(-10),
            },
            new RaceWeekend
            {
                SeasonId = 1,
                Round = 2,
                Name = "Next Upcoming Race",
                CircuitId = circuits[1].Id,
                RaceDate = now.AddDays(5),
            },
        };

        context.RaceWeekends.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceWeekendByRoundAsync(1, 2);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    #endregion

    #region GetIdByRoundAsync Tests

    [Fact]
    public async Task GetIdByRoundAsync_ReturnsId_WhenRaceWeekendExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuit = CreateCircuit("Circuit 1", "Location", "Country");
        context.Circuits.Add(circuit);
        await context.SaveChangesAsync();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 3,
            Name = "Race 3",
            CircuitId = circuit.Id,
            RaceDate = new DateTime(2026, 4, 5, 15, 0, 0, DateTimeKind.Utc),
        };

        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetIdByRoundAsync(1, 3);

        // Assert
        Assert.Equal(race.Id, result);
    }

    [Fact]
    public async Task GetIdByRoundAsync_ReturnsNull_WhenRoundDoesNotExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        // Act
        var result = await service.GetIdByRoundAsync(1, 99);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetIdByRoundAsync_ReturnsNull_WhenSeasonDoesNotMatch()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceWeekendService(context, _mockLogger.Object);

        var circuit = CreateCircuit("Circuit 1", "Location", "Country");
        context.Circuits.Add(circuit);
        await context.SaveChangesAsync();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 1,
            Name = "Race 1",
            CircuitId = circuit.Id,
            RaceDate = new DateTime(2026, 3, 22, 15, 0, 0, DateTimeKind.Utc),
        };

        context.RaceWeekends.Add(race);
        await context.SaveChangesAsync();

        // Act — query season 2, which has no races
        var result = await service.GetIdByRoundAsync(2, 1);

        // Assert
        Assert.Null(result);
    }

    #endregion
}
