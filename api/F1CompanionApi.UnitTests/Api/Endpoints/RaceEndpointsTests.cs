using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class RaceEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<IRaceService> _mockRaceService;

    public RaceEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockRaceService = new Mock<IRaceService>();
    }

    #region GetRacesAsync Tests

    [Fact]
    public async Task GetRacesAsync_ReturnsOk_WhenRacesExistForSpecificSeason()
    {
        // Arrange
        var seasonId = 1;
        var races = new List<RaceResponse>
        {
            new RaceResponse
            {
                Id = 1,
                SeasonId = seasonId,
                Round = 1,
                Name = "Bahrain Grand Prix",
                Location = "Sakhir",
                Circuit = "Bahrain International Circuit",
                Country = "Bahrain",
                RaceDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
                LockDeadline = new DateTime(2024, 3, 1, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = false
            },
            new RaceResponse
            {
                Id = 2,
                SeasonId = seasonId,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                Location = "Jeddah",
                Circuit = "Jeddah Corniche Circuit",
                Country = "Saudi Arabia",
                RaceDate = new DateTime(2024, 3, 9, 0, 0, 0, DateTimeKind.Utc),
                LockDeadline = new DateTime(2024, 3, 8, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = true
            }
        };

        _mockRaceService.Setup(x => x.GetRacesAsync(seasonId))
            .ReturnsAsync(races);

        // Act
        var result = await InvokeGetRacesAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceResponse>>)result;
        Assert.Equal(2, okResult.Value!.Count());
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsOk_WhenRacesExistForCurrentSeason()
    {
        // Arrange - no seasonId provided, should fetch current season races
        int? seasonId = null;
        var races = new List<RaceResponse>
        {
            new RaceResponse
            {
                Id = 10,
                SeasonId = 2,
                Round = 1,
                Name = "Australian Grand Prix",
                Location = "Melbourne",
                Circuit = "Albert Park Circuit",
                Country = "Australia",
                RaceDate = new DateTime(2024, 3, 24, 0, 0, 0, DateTimeKind.Utc),
                LockDeadline = null,
                IsCurrent = true
            }
        };

        _mockRaceService.Setup(x => x.GetRacesAsync(seasonId))
            .ReturnsAsync(races);

        // Act
        var result = await InvokeGetRacesAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceResponse>>)result;
        Assert.Single(okResult.Value!);
        Assert.Equal("Australian Grand Prix", okResult.Value!.First().Name);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsOk_WhenNoRacesExistForSeason()
    {
        // Arrange
        var seasonId = 999;
        var emptyRaces = new List<RaceResponse>();

        _mockRaceService.Setup(x => x.GetRacesAsync(seasonId))
            .ReturnsAsync(emptyRaces);

        // Act
        var result = await InvokeGetRacesAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceResponse>>)result;
        Assert.Empty(okResult.Value!);
    }

    [Fact]
    public async Task GetRacesAsync_ReturnsOk_WhenNoSeasonIdProvidedAndNoCurrentSeason()
    {
        // Arrange - no seasonId and service returns empty list
        int? seasonId = null;
        var emptyRaces = new List<RaceResponse>();

        _mockRaceService.Setup(x => x.GetRacesAsync(seasonId))
            .ReturnsAsync(emptyRaces);

        // Act
        var result = await InvokeGetRacesAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceResponse>>)result;
        Assert.Empty(okResult.Value!);
    }

    #endregion

    #region GetRaceByIdAsync Tests

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsOk_WhenRaceExists()
    {
        // Arrange
        var race = new RaceResponse
        {
            Id = 1,
            SeasonId = 1,
            Round = 5,
            Name = "Monaco Grand Prix",
            Location = "Monte Carlo",
            Circuit = "Circuit de Monaco",
            Country = "Monaco",
            RaceDate = new DateTime(2024, 5, 26, 0, 0, 0, DateTimeKind.Utc),
            LockDeadline = new DateTime(2024, 5, 25, 12, 0, 0, DateTimeKind.Utc),
            IsCurrent = true
        };

        _mockRaceService.Setup(x => x.GetRaceByIdAsync(1))
            .ReturnsAsync(race);

        // Act
        var result = await InvokeGetRaceByIdAsync(1);

        // Assert
        Assert.IsType<Ok<RaceResponse>>(result);
        var okResult = (Ok<RaceResponse>)result;
        Assert.Equal(1, okResult.Value!.Id);
        Assert.Equal("Monaco Grand Prix", okResult.Value!.Name);
    }

    [Fact]
    public async Task GetRaceByIdAsync_Returns404_WhenRaceDoesNotExist()
    {
        // Arrange
        _mockRaceService.Setup(x => x.GetRaceByIdAsync(999))
            .ReturnsAsync((RaceResponse?)null);

        // Act
        var result = await InvokeGetRaceByIdAsync(999);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
        Assert.Equal("Race not found", problemResult.ProblemDetails.Detail);
    }

    [Fact]
    public async Task GetRaceByIdAsync_ReturnsOk_WithNullLockDeadline()
    {
        // Arrange
        var race = new RaceResponse
        {
            Id = 2,
            SeasonId = 1,
            Round = 10,
            Name = "British Grand Prix",
            Location = "Silverstone",
            Circuit = "Silverstone Circuit",
            Country = "United Kingdom",
            RaceDate = new DateTime(2024, 7, 7, 0, 0, 0, DateTimeKind.Utc),
            LockDeadline = null,
            IsCurrent = false
        };

        _mockRaceService.Setup(x => x.GetRaceByIdAsync(2))
            .ReturnsAsync(race);

        // Act
        var result = await InvokeGetRaceByIdAsync(2);

        // Assert
        Assert.IsType<Ok<RaceResponse>>(result);
        var okResult = (Ok<RaceResponse>)result;
        Assert.Equal(2, okResult.Value!.Id);
        Assert.Null(okResult.Value!.LockDeadline);
    }

    #endregion

    #region Helper Methods

    private async Task<IResult> InvokeGetRacesAsync(int? seasonId)
    {
        var method = typeof(RaceEndpoints).GetMethod(
            "GetRacesAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object?[] { _mockRaceService.Object, seasonId, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetRaceByIdAsync(int id)
    {
        var method = typeof(RaceEndpoints).GetMethod(
            "GetRaceByIdAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockRaceService.Object, id, _mockLogger.Object }
        )!;

        return await task;
    }

    #endregion
}
