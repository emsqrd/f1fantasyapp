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

    public ConstructorServiceTests()
    {
        _mockLogger = new Mock<ILogger<ConstructorService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetConstructorsAsync_ReturnsAllConstructors_WhenActiveOnlyIsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(context, _mockLogger.Object);

        var constructors = new[]
        {
            new Constructor
            {
                Name = "McLaren",
                FullName = "McLaren F1 Team",
                CountryAbbreviation = "GBR",
                IsActive = true
            },
            new Constructor
            {
                Name = "Williams",
                FullName = "Williams Racing",
                CountryAbbreviation = "GBR",
                IsActive = false
            }
        };

        context.Constructors.AddRange(constructors);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetConstructorsAsync(null);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
    }

    [Fact]
    public async Task GetConstructorsAsync_ReturnsOnlyActiveConstructors_WhenActiveOnlyIsTrue()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(context, _mockLogger.Object);

        var constructors = new[]
        {
            new Constructor
            {
                Name = "McLaren",
                FullName = "McLaren F1 Team",
                CountryAbbreviation = "GBR",
                IsActive = true
            },
            new Constructor
            {
                Name = "Williams",
                FullName = "Williams Racing",
                CountryAbbreviation = "GBR",
                IsActive = false
            }
        };

        context.Constructors.AddRange(constructors);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetConstructorsAsync(true);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("McLaren", result.First().Name);
    }

    [Fact]
    public async Task GetConstructorsAsync_ReturnsConstructorsSortedByName()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(context, _mockLogger.Object);

        var constructors = new[]
        {
            new Constructor
            {
                Name = "Red Bull Racing",
                FullName = "Oracle Red Bull Racing",
                CountryAbbreviation = "AUT",
                IsActive = true
            },
            new Constructor
            {
                Name = "Ferrari",
                FullName = "Scuderia Ferrari",
                CountryAbbreviation = "ITA",
                IsActive = true
            }
        };

        context.Constructors.AddRange(constructors);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetConstructorsAsync(null);

        // Assert
        var constructorList = result.ToList();
        Assert.Equal("Ferrari", constructorList[0].Name);
        Assert.Equal("Red Bull Racing", constructorList[1].Name);
    }

    [Fact]
    public async Task GetConstructorByIdAsync_ExistingConstructor_ReturnsConstructor()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new ConstructorService(context, _mockLogger.Object);

        var constructor = new Constructor
        {
            Name = "McLaren",
            FullName = "McLaren F1 Team",
            CountryAbbreviation = "GBR",
            IsActive = true
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
        var service = new ConstructorService(context, _mockLogger.Object);

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
        var service = new ConstructorService(context, _mockLogger.Object);

        // Act
        var result = await service.GetConstructorByIdAsync(1);

        // Assert
        Assert.Null(result);
    }
}
