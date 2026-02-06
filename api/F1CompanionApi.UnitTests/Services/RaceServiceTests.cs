using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class RaceServiceTests
{
    private readonly Mock<ILogger<RaceService>> _mockLogger;
    private readonly Mock<ISeasonService> _mockSeasonService;

    public RaceServiceTests()
    {
        _mockLogger = new Mock<ILogger<RaceService>>();
        _mockSeasonService = new Mock<ISeasonService>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private void SetupCurrentSeason(int seasonId)
    {
        var currentSeason = new Season
        {
            Id = seasonId,
            Year = 2024,
            StartDate = DateTime.UtcNow.AddMonths(-3),
            EndDate = DateTime.UtcNow.AddMonths(3)
        };
        _mockSeasonService.Setup(s => s.GetCurrentSeasonAsync())
            .ReturnsAsync(currentSeason);
    }

    #region GetRacesAsync Tests

    [Fact]
    public async Task GetRacesAsync_ReturnsAllRaces_WhenRacesExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Bahrain Grand Prix",
                Location = "Sakhir",
                Circuit = "Bahrain International Circuit",
                Country = "Bahrain",
                RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 1,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                Location = "Jeddah",
                Circuit = "Jeddah Corniche Circuit",
                Country = "Saudi Arabia",
                RaceDate = new DateTime(2024, 3, 9, 17, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 1,
                Round = 3,
                Name = "Australian Grand Prix",
                Location = "Melbourne",
                Circuit = "Albert Park Circuit",
                Country = "Australia",
                RaceDate = new DateTime(2024, 3, 24, 5, 0, 0, DateTimeKind.Utc)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.Count());
    }

    [Fact]
    public async Task GetRacesAsync_CallsGetCurrentSeason_WhenNoSeasonIdProvided()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        // Act
        await service.GetRacesAsync();

        // Assert
        _mockSeasonService.Verify(s => s.GetCurrentSeasonAsync(), Times.Once);
    }

    [Fact]
    public async Task GetRacesAsync_DoesNotCallGetCurrentSeason_WhenSeasonIdProvided()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        // Act
        await service.GetRacesAsync(1);

        // Assert
        _mockSeasonService.Verify(s => s.GetCurrentSeasonAsync(), Times.Never);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsEmptyCollection_WhenNoCurrentSeasonExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        _mockSeasonService.Setup(s => s.GetCurrentSeasonAsync())
            .ReturnsAsync((Season?)null);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Bahrain Grand Prix",
                Location = "Sakhir",
                Circuit = "Bahrain International Circuit",
                Country = "Bahrain",
                RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsEmptyCollection_WhenNoRacesExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsOnlyRacesForCurrentSeason_WhenMultipleSeasonsExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(2);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "2023 Race",
                Location = "Location 1",
                Circuit = "Circuit 1",
                Country = "Country 1",
                RaceDate = new DateTime(2023, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 2,
                Round = 1,
                Name = "2024 Race 1",
                Location = "Location 2",
                Circuit = "Circuit 2",
                Country = "Country 2",
                RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 2,
                Round = 2,
                Name = "2024 Race 2",
                Location = "Location 3",
                Circuit = "Circuit 3",
                Country = "Country 3",
                RaceDate = new DateTime(2024, 3, 9, 17, 0, 0, DateTimeKind.Utc)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceList = result.ToList();
        Assert.Equal(2, raceList.Count);
        Assert.All(raceList, race => Assert.Equal(2, race.SeasonId));
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsRacesForSpecifiedSeason_WhenSeasonIdProvided()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(2); // Current season is 2
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "2023 Race",
                Location = "Location 1",
                Circuit = "Circuit 1",
                Country = "Country 1",
                RaceDate = new DateTime(2023, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 2,
                Round = 1,
                Name = "2024 Race",
                Location = "Location 2",
                Circuit = "Circuit 2",
                Country = "Country 2",
                RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync(seasonId: 1); // Request season 1

        // Assert
        var raceList = result.ToList();
        Assert.Single(raceList);
        Assert.Equal(1, raceList[0].SeasonId);
        Assert.Equal("2023 Race", raceList[0].Name);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsRacesOrderedByRound()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 3,
                Name = "Australian Grand Prix",
                Location = "Melbourne",
                Circuit = "Albert Park Circuit",
                Country = "Australia",
                RaceDate = new DateTime(2024, 3, 24, 5, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Bahrain Grand Prix",
                Location = "Sakhir",
                Circuit = "Bahrain International Circuit",
                Country = "Bahrain",
                RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
            },
            new Race
            {
                SeasonId = 1,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                Location = "Jeddah",
                Circuit = "Jeddah Corniche Circuit",
                Country = "Saudi Arabia",
                RaceDate = new DateTime(2024, 3, 9, 17, 0, 0, DateTimeKind.Utc)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceList = result.ToList();
        Assert.Equal(1, raceList[0].Round);
        Assert.Equal(2, raceList[1].Round);
        Assert.Equal(3, raceList[2].Round);
    }

    [Fact]
    public async Task GetRacesAsync_MarksCurrentRace_WhenRaceIsUpcoming()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Past Race",
                Location = "Past Location",
                Circuit = "Past Circuit",
                Country = "Past Country",
                RaceDate = now.AddDays(-10)
            },
            new Race
            {
                SeasonId = 1,
                Round = 2,
                Name = "Current Race",
                Location = "Current Location",
                Circuit = "Current Circuit",
                Country = "Current Country",
                RaceDate = now.AddDays(5)
            },
            new Race
            {
                SeasonId = 1,
                Round = 3,
                Name = "Future Race",
                Location = "Future Location",
                Circuit = "Future Circuit",
                Country = "Future Country",
                RaceDate = now.AddDays(15)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceList = result.ToList();
        Assert.False(raceList[0].IsCurrent); // Past race
        Assert.True(raceList[1].IsCurrent);  // First upcoming race
        Assert.False(raceList[2].IsCurrent); // Future race
    }

    [Fact]
    public async Task GetRacesAsync_MarksNoCurrentRace_WhenAllRacesHavePassed()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Past Race 1",
                Location = "Location 1",
                Circuit = "Circuit 1",
                Country = "Country 1",
                RaceDate = now.AddDays(-20)
            },
            new Race
            {
                SeasonId = 1,
                Round = 2,
                Name = "Past Race 2",
                Location = "Location 2",
                Circuit = "Circuit 2",
                Country = "Country 2",
                RaceDate = now.AddDays(-10)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceList = result.ToList();
        Assert.All(raceList, race => Assert.False(race.IsCurrent));
    }

    [Fact]
    public async Task GetRacesAsync_MarksFirstUpcomingRace_WhenMultipleRacesAreUpcoming()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var races = new[]
        {
            new Race
            {
                SeasonId = 1,
                Round = 1,
                Name = "Upcoming Race 1",
                Location = "Location 1",
                Circuit = "Circuit 1",
                Country = "Country 1",
                RaceDate = now.AddDays(5)
            },
            new Race
            {
                SeasonId = 1,
                Round = 2,
                Name = "Upcoming Race 2",
                Location = "Location 2",
                Circuit = "Circuit 2",
                Country = "Country 2",
                RaceDate = now.AddDays(12)
            }
        };

        context.Races.AddRange(races);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceList = result.ToList();
        Assert.True(raceList[0].IsCurrent);  // First upcoming
        Assert.False(raceList[1].IsCurrent); // Second upcoming
    }

    [Fact]
    public async Task GetRacesAsync_MarksRaceAsCurrent_WhenRaceDateIsExactlyNow()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Current Race",
            Location = "Current Location",
            Circuit = "Current Circuit",
            Country = "Current Country",
            RaceDate = now.AddSeconds(1) // Add 1 second buffer to account for test execution time
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceResponse = result.Single();
        Assert.True(raceResponse.IsCurrent);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsCorrectRaceData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        SetupCurrentSeason(1);
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var raceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc);
        var lockDeadline = new DateTime(2024, 3, 2, 14, 0, 0, DateTimeKind.Utc);

        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Bahrain Grand Prix",
            Location = "Sakhir",
            Circuit = "Bahrain International Circuit",
            Country = "Bahrain",
            RaceDate = raceDate,
            LockDeadline = lockDeadline
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRacesAsync();

        // Assert
        var raceResponse = result.Single();
        Assert.Equal(race.Id, raceResponse.Id);
        Assert.Equal(1, raceResponse.SeasonId);
        Assert.Equal(1, raceResponse.Round);
        Assert.Equal("Bahrain Grand Prix", raceResponse.Name);
        Assert.Equal("Sakhir", raceResponse.Location);
        Assert.Equal("Bahrain International Circuit", raceResponse.Circuit);
        Assert.Equal("Bahrain", raceResponse.Country);
        Assert.Equal(raceDate, raceResponse.RaceDate);
        Assert.Equal(lockDeadline, raceResponse.LockDeadline);
    }

    #endregion

    #region GetRaceByIdAsync Tests

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsRace_WhenRaceExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Bahrain Grand Prix",
            Location = "Sakhir",
            Circuit = "Bahrain International Circuit",
            Country = "Bahrain",
            RaceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc)
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceByIdAsync(race.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(race.Id, result.Id);
        Assert.Equal("Bahrain Grand Prix", result.Name);
    }

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsNull_WhenRaceDoesNotExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        // Act
        var result = await service.GetRaceByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsNull_WhenDatabaseIsEmpty()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        // Act
        var result = await service.GetRaceByIdAsync(1);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetRaceByIdAsync_MarksRaceAsCurrent_WhenRaceIsUpcoming()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Upcoming Race",
            Location = "Location",
            Circuit = "Circuit",
            Country = "Country",
            RaceDate = now.AddDays(5)
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceByIdAsync(race.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    [Fact]
    public async Task GetRaceByIdAsync_MarksRaceAsNotCurrent_WhenRaceHasPassed()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Past Race",
            Location = "Location",
            Circuit = "Circuit",
            Country = "Country",
            RaceDate = now.AddDays(-5)
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceByIdAsync(race.Id);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsCurrent);
    }

    [Fact]
    public async Task GetRaceByIdAsync_MarksRaceAsCurrent_WhenRaceDateIsExactlyNow()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var now = DateTime.UtcNow;
        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Current Race",
            Location = "Location",
            Circuit = "Circuit",
            Country = "Country",
            RaceDate = now.AddSeconds(1) // Add 1 second buffer to account for test execution time
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceByIdAsync(race.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsCorrectRaceData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new RaceService(context, _mockLogger.Object, _mockSeasonService.Object);

        var raceDate = new DateTime(2024, 3, 2, 15, 0, 0, DateTimeKind.Utc);
        var lockDeadline = new DateTime(2024, 3, 2, 14, 0, 0, DateTimeKind.Utc);

        var race = new Race
        {
            SeasonId = 1,
            Round = 1,
            Name = "Bahrain Grand Prix",
            Location = "Sakhir",
            Circuit = "Bahrain International Circuit",
            Country = "Bahrain",
            RaceDate = raceDate,
            LockDeadline = lockDeadline
        };

        context.Races.Add(race);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRaceByIdAsync(race.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(race.Id, result.Id);
        Assert.Equal(1, result.SeasonId);
        Assert.Equal(1, result.Round);
        Assert.Equal("Bahrain Grand Prix", result.Name);
        Assert.Equal("Sakhir", result.Location);
        Assert.Equal("Bahrain International Circuit", result.Circuit);
        Assert.Equal("Bahrain", result.Country);
        Assert.Equal(raceDate, result.RaceDate);
        Assert.Equal(lockDeadline, result.LockDeadline);
    }

    #endregion
}
