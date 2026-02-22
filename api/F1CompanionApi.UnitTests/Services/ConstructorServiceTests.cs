using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class ConstructorServiceTests
{
    private readonly Mock<ILogger<ConstructorService>> _mockLogger;
    private readonly Mock<ISeasonService> _mockSeasonService;

    public ConstructorServiceTests()
    {
        _mockLogger = new Mock<ILogger<ConstructorService>>();
        _mockSeasonService = new Mock<ISeasonService>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetConstructorsAsync_WithSeasonYear_ReturnsConstructorsForThatSeason()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        var season = new Season
        {
            Year = 2026,
            StartDate = new DateTime(2026, 3, 1),
            EndDate = new DateTime(2026, 12, 1),
        };
        var constructor1 = new Constructor
        {
            Name = "McLaren",
            FullName = "McLaren F1 Team",
            Abbreviation = "MCL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };
        var constructor2 = new Constructor
        {
            Name = "Williams",
            FullName = "Williams Racing",
            Abbreviation = "WIL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.AddRange(constructor1, constructor2);
        await context.SaveChangesAsync();

        // Only link constructor1 to the 2026 season
        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = constructor1.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetConstructorsAsync(2026);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("McLaren", result.First().Name);
    }

    [Fact]
    public async Task GetConstructorsAsync_WithNoSeasonYear_UsesCurrentSeason()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        var season = new Season
        {
            Year = 2026,
            StartDate = new DateTime(2026, 3, 1),
            EndDate = new DateTime(2026, 12, 1),
        };
        var constructor = new Constructor
        {
            Name = "McLaren",
            FullName = "McLaren F1 Team",
            Abbreviation = "MCL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.Add(constructor);
        await context.SaveChangesAsync();

        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(null)).ReturnsAsync(season);

        // Act
        var result = await service.GetConstructorsAsync(null);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("McLaren", result.First().Name);
    }

    [Fact]
    public async Task GetConstructorsAsync_ExcludesInactiveSeasonConstructors()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        var season = new Season
        {
            Year = 2026,
            StartDate = new DateTime(2026, 3, 1),
            EndDate = new DateTime(2026, 12, 1),
        };
        var activeConstructor = new Constructor
        {
            Name = "McLaren",
            FullName = "McLaren F1 Team",
            Abbreviation = "MCL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };
        var inactiveConstructor = new Constructor
        {
            Name = "Williams",
            FullName = "Williams Racing",
            Abbreviation = "WIL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.AddRange(activeConstructor, inactiveConstructor);
        await context.SaveChangesAsync();

        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = activeConstructor.Id,
                IsActive = true,
            }
        );
        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = inactiveConstructor.Id,
                IsActive = false,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetConstructorsAsync(2026);

        // Assert
        Assert.Single(result);
        Assert.Equal("McLaren", result.First().Name);
    }

    [Fact]
    public async Task GetConstructorsAsync_ReturnsConstructorsSortedByName()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        var season = new Season
        {
            Year = 2026,
            StartDate = new DateTime(2026, 3, 1),
            EndDate = new DateTime(2026, 12, 1),
        };
        var constructor1 = new Constructor
        {
            Name = "Red Bull Racing",
            FullName = "Oracle Red Bull Racing",
            Abbreviation = "RBR",
            CountryAbbreviation = "AUT",
            IsActive = true,
        };
        var constructor2 = new Constructor
        {
            Name = "Ferrari",
            FullName = "Scuderia Ferrari",
            Abbreviation = "FER",
            CountryAbbreviation = "ITA",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.AddRange(constructor1, constructor2);
        await context.SaveChangesAsync();

        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = constructor1.Id,
                IsActive = true,
            }
        );
        context.SeasonConstructors.Add(
            new SeasonConstructor
            {
                SeasonId = season.Id,
                ConstructorId = constructor2.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetConstructorsAsync(2026);

        // Assert
        var constructorList = result.ToList();
        Assert.Equal("Ferrari", constructorList[0].Name);
        Assert.Equal("Red Bull Racing", constructorList[1].Name);
    }

    [Fact]
    public async Task GetConstructorsAsync_NoSeasons_ReturnsEmptyList()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        _mockSeasonService.Setup(s => s.GetSeasonAsync(null)).ReturnsAsync((Season?)null);

        // Act
        var result = await service.GetConstructorsAsync(null);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetConstructorByIdAsync_ExistingConstructor_ReturnsConstructor()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        var constructor = new Constructor
        {
            Name = "McLaren",
            FullName = "McLaren F1 Team",
            Abbreviation = "MCL",
            CountryAbbreviation = "GBR",
            IsActive = true,
        };

        context.Constructors.Add(constructor);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetConstructorByIdAsync(constructor.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(constructor.Id, result.Id);
        Assert.Equal("McLaren", result.Name);
        Assert.Equal("GBR", result.CountryAbbreviation);
    }

    [Fact]
    public async Task GetConstructorByIdAsync_NonExistentConstructor_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        // Act
        var result = await service.GetConstructorByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetConstructorByIdAsync_EmptyDatabase_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(
            context,
            _mockSeasonService.Object,
            _mockLogger.Object
        );

        // Act
        var result = await service.GetConstructorByIdAsync(1);

        // Assert
        Assert.Null(result);
    }
}
