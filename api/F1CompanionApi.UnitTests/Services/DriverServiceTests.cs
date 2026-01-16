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

    public DriverServiceTests()
    {
        _mockLogger = new Mock<ILogger<DriverService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetDriversAsync_ReturnsAllDrivers_WhenActiveOnlyIsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockLogger.Object);

        var drivers = new[]
        {
            new Driver
            {
                FirstName = "Oscar",
                LastName = "Piastri",
                Abbreviation = "PIA",
                CountryAbbreviation = "AUS",
                IsActive = true
            },
            new Driver
            {
                FirstName = "Fernando",
                LastName = "Alonso",
                Abbreviation = "ALO",
                CountryAbbreviation = "ESP",
                IsActive = false
            }
        };

        context.Drivers.AddRange(drivers);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetDriversAsync(null);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
    }

    [Fact]
    public async Task GetDriversAsync_ReturnsOnlyActiveDrivers_WhenActiveOnlyIsTrue()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockLogger.Object);

        var drivers = new[]
        {
            new Driver
            {
                FirstName = "Oscar",
                LastName = "Piastri",
                Abbreviation = "PIA",
                CountryAbbreviation = "AUS",
                IsActive = true
            },
            new Driver
            {
                FirstName = "Fernando",
                LastName = "Alonso",
                Abbreviation = "ALO",
                CountryAbbreviation = "ESP",
                IsActive = false
            }
        };

        context.Drivers.AddRange(drivers);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetDriversAsync(true);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Piastri", result.First().LastName);
    }

    [Fact]
    public async Task GetDriversAsync_ReturnsDriversSortedByLastName()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockLogger.Object);

        var drivers = new[]
        {
            new Driver
            {
                FirstName = "Max",
                LastName = "Verstappen",
                Abbreviation = "VER",
                CountryAbbreviation = "NED",
                IsActive = true
            },
            new Driver
            {
                FirstName = "Fernando",
                LastName = "Alonso",
                Abbreviation = "ALO",
                CountryAbbreviation = "ESP",
                IsActive = true
            }
        };

        context.Drivers.AddRange(drivers);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetDriversAsync(null);

        // Assert
        var driverList = result.ToList();
        Assert.Equal("Alonso", driverList[0].LastName);
        Assert.Equal("Verstappen", driverList[1].LastName);
    }

    [Fact]
    public async Task GetDriverByIdAsync_ExistingDriver_ReturnsDriver()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new DriverService(context, _mockLogger.Object);

        var driver = new Driver
        {
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS",
            IsActive = true
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
        var service = new DriverService(context, _mockLogger.Object);

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
        var service = new DriverService(context, _mockLogger.Object);

        // Act
        var result = await service.GetDriverByIdAsync(1);

        // Assert
        Assert.Null(result);
    }
}
