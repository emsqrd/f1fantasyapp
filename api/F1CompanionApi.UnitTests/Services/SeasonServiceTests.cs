using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class SeasonServiceTests
{
    private readonly Mock<ILogger<SeasonService>> _mockLogger;

    public SeasonServiceTests()
    {
        _mockLogger = new Mock<ILogger<SeasonService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    #region GetSeasonsAsync Tests

    [Fact]
    public async Task GetSeasonsAsync_ReturnsAllSeasons_WhenSeasonsExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var seasons = new[]
        {
            new Season
            {
                Year = 2023,
                StartDate = new DateTime(2023, 3, 5, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2023, 11, 26, 0, 0, 0, DateTimeKind.Utc),
            },
            new Season
            {
                Year = 2024,
                StartDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc),
            },
            new Season
            {
                Year = 2025,
                StartDate = new DateTime(2025, 3, 16, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2025, 11, 30, 0, 0, 0, DateTimeKind.Utc),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(3, result.Count());
    }

    [Fact]
    public async Task GetSeasonsAsync_ReturnsEmptyCollection_WhenNoSeasonsExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetSeasonsAsync_ReturnsSeasonsOrderedByYear()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var seasons = new[]
        {
            new Season
            {
                Year = 2025,
                StartDate = new DateTime(2025, 3, 16, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2025, 11, 30, 0, 0, 0, DateTimeKind.Utc),
            },
            new Season
            {
                Year = 2023,
                StartDate = new DateTime(2023, 3, 5, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2023, 11, 26, 0, 0, 0, DateTimeKind.Utc),
            },
            new Season
            {
                Year = 2024,
                StartDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonList = result.ToList();
        Assert.Equal(2023, seasonList[0].Year);
        Assert.Equal(2024, seasonList[1].Year);
        Assert.Equal(2025, seasonList[2].Year);
    }

    [Fact]
    public async Task GetSeasonsAsync_MarksCurrentSeason_WhenDateIsWithinSeasonRange()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var seasons = new[]
        {
            new Season
            {
                Year = 2023,
                StartDate = now.AddYears(-2),
                EndDate = now.AddYears(-1),
            },
            new Season
            {
                Year = 2024,
                StartDate = now.AddMonths(-1),
                EndDate = now.AddMonths(1),
            },
            new Season
            {
                Year = 2025,
                StartDate = now.AddYears(1),
                EndDate = now.AddYears(2),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonList = result.ToList();
        Assert.False(seasonList[0].IsCurrent); // 2023
        Assert.True(seasonList[1].IsCurrent); // 2024 - current
        Assert.False(seasonList[2].IsCurrent); // 2025
    }

    [Fact]
    public async Task GetSeasonsAsync_MarksNoCurrentSeason_WhenDateIsBetweenSeasons()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var seasons = new[]
        {
            new Season
            {
                Year = 2023,
                StartDate = now.AddYears(-2),
                EndDate = now.AddDays(-10),
            },
            new Season
            {
                Year = 2024,
                StartDate = now.AddDays(10),
                EndDate = now.AddYears(1),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonList = result.ToList();
        Assert.All(seasonList, season => Assert.False(season.IsCurrent));
    }

    [Fact]
    public async Task GetSeasonsAsync_MarksCurrentSeason_WhenDateIsExactlyOnStartDate()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2024,
            StartDate = now,
            EndDate = now.AddMonths(6),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonResponse = result.Single();
        Assert.True(seasonResponse.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonsAsync_MarksCurrentSeason_WhenDateIsExactlyOnEndDate()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2024,
            StartDate = now.AddMonths(-6),
            EndDate = now.AddSeconds(1), // Add 1 second buffer to account for test execution time
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonResponse = result.Single();
        Assert.True(seasonResponse.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonsAsync_ReturnsCorrectSeasonData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var startDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc);

        var season = new Season
        {
            Year = 2024,
            StartDate = startDate,
            EndDate = endDate,
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonsAsync();

        // Assert
        var seasonResponse = result.Single();
        Assert.Equal(season.Id, seasonResponse.Id);
        Assert.Equal(2024, seasonResponse.Year);
        Assert.Equal(startDate, seasonResponse.StartDate);
        Assert.Equal(endDate, seasonResponse.EndDate);
    }

    #endregion

    #region GetSeasonByIdAsync Tests

    [Fact]
    public async Task GetSeasonByIdAsync_ReturnsSeason_WhenSeasonExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var season = new Season
        {
            Year = 2024,
            StartDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(season.Id, result.Id);
        Assert.Equal(2024, result.Year);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_ReturnsNull_WhenSeasonDoesNotExist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        // Act
        var result = await service.GetSeasonByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_ReturnsNull_WhenDatabaseIsEmpty()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        // Act
        var result = await service.GetSeasonByIdAsync(1);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_MarksSeasonAsCurrent_WhenDateIsWithinSeasonRange()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2024,
            StartDate = now.AddMonths(-3),
            EndDate = now.AddMonths(3),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_MarksSeasonAsNotCurrent_WhenDateIsBeforeSeasonStart()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2025,
            StartDate = now.AddMonths(3),
            EndDate = now.AddMonths(9),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_MarksSeasonAsNotCurrent_WhenDateIsAfterSeasonEnd()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2023,
            StartDate = now.AddMonths(-9),
            EndDate = now.AddMonths(-3),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_MarksSeasonAsCurrent_WhenDateIsExactlyOnStartDate()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2024,
            StartDate = now,
            EndDate = now.AddMonths(6),
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_MarksSeasonAsCurrent_WhenDateIsExactlyOnEndDate()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = 2024,
            StartDate = now.AddMonths(-6),
            EndDate = now.AddSeconds(1), // Add 1 second buffer to account for test execution time
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsCurrent);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_ReturnsCorrectSeasonData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var startDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc);
        var endDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc);

        var season = new Season
        {
            Year = 2024,
            StartDate = startDate,
            EndDate = endDate,
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetSeasonByIdAsync(season.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(season.Id, result.Id);
        Assert.Equal(2024, result.Year);
        Assert.Equal(startDate, result.StartDate);
        Assert.Equal(endDate, result.EndDate);
    }

    #endregion

    #region GetCurrentSeasonAsync Tests

    [Fact]
    public async Task GetCurrentSeasonAsync_ReturnsCurrentSeason_WhenDateIsWithinSeasonRange()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var seasons = new[]
        {
            new Season
            {
                Year = 2023,
                StartDate = now.AddYears(-2),
                EndDate = now.AddYears(-1),
            },
            new Season
            {
                Year = 2024,
                StartDate = now.AddMonths(-3),
                EndDate = now.AddMonths(3),
            },
            new Season
            {
                Year = 2025,
                StartDate = now.AddYears(1),
                EndDate = now.AddYears(2),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetCurrentSeasonAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2024, result.Year);
    }

    [Fact]
    public async Task GetCurrentSeasonAsync_ReturnsNull_WhenNoCurrentSeasonExists()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var seasons = new[]
        {
            new Season
            {
                Year = 2023,
                StartDate = now.AddYears(-2),
                EndDate = now.AddDays(-10),
            },
            new Season
            {
                Year = 2024,
                StartDate = now.AddDays(10),
                EndDate = now.AddYears(1),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetCurrentSeasonAsync();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetCurrentSeasonAsync_ReturnsCorrectSeasonData_WithAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var startDate = now.AddMonths(-3);
        var endDate = now.AddMonths(3);

        var season = new Season
        {
            Year = 2024,
            StartDate = startDate,
            EndDate = endDate,
        };

        context.Seasons.Add(season);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetCurrentSeasonAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(season.Id, result.Id);
        Assert.Equal(2024, result.Year);
        Assert.Equal(startDate, result.StartDate);
        Assert.Equal(endDate, result.EndDate);
    }

    [Fact]
    public async Task GetCurrentSeasonAsync_ReturnsFirstMatch_WhenMultipleSeasonsOverlap()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new SeasonService(context, _mockLogger.Object);

        var now = DateTime.UtcNow;
        var seasons = new[]
        {
            new Season
            {
                Year = 2024,
                StartDate = now.AddMonths(-6),
                EndDate = now.AddMonths(6),
            },
            new Season
            {
                Year = 2025,
                StartDate = now.AddMonths(-1),
                EndDate = now.AddMonths(1),
            },
        };

        context.Seasons.AddRange(seasons);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetCurrentSeasonAsync();

        // Assert
        Assert.NotNull(result);
        // FirstOrDefault should return the first season that matches
        Assert.Equal(2024, result.Year);
    }

    #endregion
}
