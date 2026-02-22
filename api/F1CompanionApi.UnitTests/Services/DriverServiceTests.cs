using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class DriverServiceTests
{
    private readonly Mock<ILogger<DriverService>> _mockLogger;
    private readonly Mock<ISeasonService> _mockSeasonService;

    public DriverServiceTests()
    {
        _mockLogger = new Mock<ILogger<DriverService>>();
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
    public async Task GetDriversAsync_WithSeasonYear_ReturnsDriversForThatSeason()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

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
        var driver1 = new Driver
        {
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS",
            IsActive = true,
        };
        var driver2 = new Driver
        {
            FirstName = "Fernando",
            LastName = "Alonso",
            Abbreviation = "ALO",
            CountryAbbreviation = "ESP",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.Add(constructor);
        context.Drivers.AddRange(driver1, driver2);
        await context.SaveChangesAsync();

        // Only link driver1 to the 2026 season
        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = driver1.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetDriversAsync(2026);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Piastri", result.First().LastName);
    }

    [Fact]
    public async Task GetDriversAsync_WithNoSeasonYear_UsesCurrentSeason()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

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
        var driver = new Driver
        {
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.Add(constructor);
        context.Drivers.Add(driver);
        await context.SaveChangesAsync();

        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = driver.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(null)).ReturnsAsync(season);

        // Act
        var result = await service.GetDriversAsync(null);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Piastri", result.First().LastName);
    }

    [Fact]
    public async Task GetDriversAsync_ExcludesInactiveSeasonDrivers()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

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
        var activeDriver = new Driver
        {
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS",
            IsActive = true,
        };
        var inactiveDriver = new Driver
        {
            FirstName = "Fernando",
            LastName = "Alonso",
            Abbreviation = "ALO",
            CountryAbbreviation = "ESP",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.Add(constructor);
        context.Drivers.AddRange(activeDriver, inactiveDriver);
        await context.SaveChangesAsync();

        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = activeDriver.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = inactiveDriver.Id,
                ConstructorId = constructor.Id,
                IsActive = false,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetDriversAsync(2026);

        // Assert
        Assert.Single(result);
        Assert.Equal("Piastri", result.First().LastName);
    }

    [Fact]
    public async Task GetDriversAsync_ReturnsDriversSortedByLastName()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

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
        var driver1 = new Driver
        {
            FirstName = "Max",
            LastName = "Verstappen",
            Abbreviation = "VER",
            CountryAbbreviation = "NED",
            IsActive = true,
        };
        var driver2 = new Driver
        {
            FirstName = "Fernando",
            LastName = "Alonso",
            Abbreviation = "ALO",
            CountryAbbreviation = "ESP",
            IsActive = true,
        };

        context.Seasons.Add(season);
        context.Constructors.Add(constructor);
        context.Drivers.AddRange(driver1, driver2);
        await context.SaveChangesAsync();

        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = driver1.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        context.SeasonDrivers.Add(
            new SeasonDriver
            {
                SeasonId = season.Id,
                DriverId = driver2.Id,
                ConstructorId = constructor.Id,
                IsActive = true,
            }
        );
        await context.SaveChangesAsync();

        _mockSeasonService.Setup(s => s.GetSeasonAsync(2026)).ReturnsAsync(season);

        // Act
        var result = await service.GetDriversAsync(2026);

        // Assert
        var driverList = result.ToList();
        Assert.Equal("Alonso", driverList[0].LastName);
        Assert.Equal("Verstappen", driverList[1].LastName);
    }

    [Fact]
    public async Task GetDriversAsync_NoSeasons_ReturnsEmptyList()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

        _mockSeasonService.Setup(s => s.GetSeasonAsync(null)).ReturnsAsync((Season?)null);

        // Act
        var result = await service.GetDriversAsync(null);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetDriverByIdAsync_ExistingDriver_ReturnsDriver()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

        var driver = new Driver
        {
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS",
            IsActive = true,
        };

        context.Drivers.Add(driver);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetDriverByIdAsync(driver.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(driver.Id, result.Id);
        Assert.Equal("Oscar", result.FirstName);
        Assert.Equal("Piastri", result.LastName);
        Assert.Equal("PIA", result.Abbreviation);
        Assert.Equal("AUS", result.CountryAbbreviation);
    }

    [Fact]
    public async Task GetDriverByIdAsync_NonExistentDriver_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

        // Act
        var result = await service.GetDriverByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetDriverByIdAsync_EmptyDatabase_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockSeasonService.Object, _mockLogger.Object);

        // Act
        var result = await service.GetDriverByIdAsync(1);

        // Assert
        Assert.Null(result);
    }
}
