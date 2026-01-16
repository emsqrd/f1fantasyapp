using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class DriverEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<IDriverService> _mockDriverService;

    public DriverEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockDriverService = new Mock<IDriverService>();
    }

    [Fact]
    public async Task GetDriversAsync_ReturnsOkWithDrivers()
    {
        // Arrange
        var drivers = new List<DriverResponse>
        {
            new DriverResponse
            {
                Id = 1,
                Type = "driver",
                FirstName = "Oscar",
                LastName = "Piastri",
                Abbreviation = "PIA",
                CountryAbbreviation = "AUS"
            },
            new DriverResponse
            {
                Id = 2,
                Type = "driver",
                FirstName = "Lando",
                LastName = "Norris",
                Abbreviation = "NOR",
                CountryAbbreviation = "GBR"
            }
        };

        _mockDriverService.Setup(x => x.GetDriversAsync(null))
            .ReturnsAsync(drivers);

        // Act
        var result = await InvokeGetDriversAsync(null);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverResponse>>>(result);
        var okResult = (Ok<IEnumerable<DriverResponse>>)result;
        Assert.Equal(2, okResult.Value!.Count());
    }

    [Fact]
    public async Task GetDriversAsync_WithActiveOnlyTrue_ReturnsOnlyActiveDrivers()
    {
        // Arrange
        var drivers = new List<DriverResponse>
        {
            new DriverResponse
            {
                Id = 1,
                Type = "driver",
                FirstName = "Oscar",
                LastName = "Piastri",
                Abbreviation = "PIA",
                CountryAbbreviation = "AUS"
            }
        };

        _mockDriverService.Setup(x => x.GetDriversAsync(true))
            .ReturnsAsync(drivers);

        // Act
        var result = await InvokeGetDriversAsync(true);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverResponse>>>(result);
        var okResult = (Ok<IEnumerable<DriverResponse>>)result;
        Assert.Single(okResult.Value!);
    }

    [Fact]
    public async Task GetDriverByIdAsync_ExistingDriver_ReturnsOk()
    {
        // Arrange
        var driver = new DriverResponse
        {
            Id = 1,
            Type = "driver",
            FirstName = "Oscar",
            LastName = "Piastri",
            Abbreviation = "PIA",
            CountryAbbreviation = "AUS"
        };

        _mockDriverService.Setup(x => x.GetDriverByIdAsync(1))
            .ReturnsAsync(driver);

        // Act
        var result = await InvokeGetDriverByIdAsync(1);

        // Assert
        Assert.IsType<Ok<DriverResponse>>(result);
        var okResult = (Ok<DriverResponse>)result;
        Assert.Equal(1, okResult.Value!.Id);
        Assert.Equal("Oscar", okResult.Value!.FirstName);
        Assert.Equal("Piastri", okResult.Value!.LastName);
    }

    [Fact]
    public async Task GetDriverByIdAsync_NonExistentDriver_ReturnsProblem()
    {
        // Arrange
        _mockDriverService.Setup(x => x.GetDriverByIdAsync(999))
            .ReturnsAsync((DriverResponse?)null);

        // Act
        var result = await InvokeGetDriverByIdAsync(999);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetDriversAsync_EmptyCollection_ReturnsOkWithEmptyList()
    {
        // Arrange
        var emptyDrivers = new List<DriverResponse>();

        _mockDriverService.Setup(x => x.GetDriversAsync(null))
            .ReturnsAsync(emptyDrivers);

        // Act
        var result = await InvokeGetDriversAsync(null);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverResponse>>>(result);
        var okResult = (Ok<IEnumerable<DriverResponse>>)result;
        Assert.Empty(okResult.Value!);
    }

    [Fact]
    public async Task GetDriversAsync_WithActiveOnlyFalse_ReturnsAllDrivers()
    {
        // Arrange
        var drivers = new List<DriverResponse>
        {
            new DriverResponse
            {
                Id = 1,
                Type = "driver",
                FirstName = "Oscar",
                LastName = "Piastri",
                Abbreviation = "PIA",
                CountryAbbreviation = "AUS"
            },
            new DriverResponse
            {
                Id = 2,
                Type = "driver",
                FirstName = "Fernando",
                LastName = "Alonso",
                Abbreviation = "ALO",
                CountryAbbreviation = "ESP"
            }
        };

        _mockDriverService.Setup(x => x.GetDriversAsync(false))
            .ReturnsAsync(drivers);

        // Act
        var result = await InvokeGetDriversAsync(false);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverResponse>>>(result);
        var okResult = (Ok<IEnumerable<DriverResponse>>)result;
        Assert.Equal(2, okResult.Value!.Count());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    public async Task GetDriverByIdAsync_BoundaryValues_ReturnsProblem(int id)
    {
        // Arrange
        _mockDriverService.Setup(x => x.GetDriverByIdAsync(id))
            .ReturnsAsync((DriverResponse?)null);

        // Act
        var result = await InvokeGetDriverByIdAsync(id);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetDriverByIdAsync_ValidDriver_ReturnsCorrectDataStructure()
    {
        // Arrange
        var driver = new DriverResponse
        {
            Id = 1,
            Type = "driver",
            FirstName = "Max",
            LastName = "Verstappen",
            Abbreviation = "VER",
            CountryAbbreviation = "NED"
        };

        _mockDriverService.Setup(x => x.GetDriverByIdAsync(1))
            .ReturnsAsync(driver);

        // Act
        var result = await InvokeGetDriverByIdAsync(1);

        // Assert
        Assert.IsType<Ok<DriverResponse>>(result);
        var okResult = (Ok<DriverResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal("driver", okResult.Value.Type);
        Assert.NotEmpty(okResult.Value.Abbreviation);
        Assert.NotEmpty(okResult.Value.CountryAbbreviation);
    }

    private async Task<IResult> InvokeGetDriversAsync(bool? activeOnly)
    {
        var method = typeof(DriverEndpoints).GetMethod(
            "GetDriversAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object?[] { _mockDriverService.Object, activeOnly, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetDriverByIdAsync(int id)
    {
        var method = typeof(DriverEndpoints).GetMethod(
            "GetDriverByIdAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockDriverService.Object, id, _mockLogger.Object }
        )!;

        return await task;
    }
}
