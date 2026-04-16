using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class RaceWeekendEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<IRaceWeekendService> _mockRaceWeekendService;

    public RaceWeekendEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockRaceWeekendService = new Mock<IRaceWeekendService>();
    }

    private CircuitResponse CreateCircuit(string name, string location, string country)
    {
        return new CircuitResponse
        {
            Id = 1,
            Name = name,
            Location = location,
            Country = country,
        };
    }

    #region GetRaceWeekendsBySeasonAsync Tests

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsOk_WhenRaceWeekendsExist()
    {
        // Arrange
        var seasonId = 1;
        var raceWeekends = new List<RaceWeekendResponse>
        {
            new RaceWeekendResponse
            {
                Id = 1,
                SeasonId = seasonId,
                Round = 1,
                Name = "Bahrain Grand Prix",
                Circuit = CreateCircuit("Bahrain International Circuit", "Sakhir", "Bahrain"),
                RaceDate = new DateTime(2026, 3, 22, 0, 0, 0, DateTimeKind.Utc),
                LockDeadline = new DateTime(2026, 3, 21, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = false,
            },
            new RaceWeekendResponse
            {
                Id = 2,
                SeasonId = seasonId,
                Round = 2,
                Name = "Saudi Arabian Grand Prix",
                Circuit = CreateCircuit("Jeddah Corniche Circuit", "Jeddah", "Saudi Arabia"),
                RaceDate = new DateTime(2026, 3, 29, 0, 0, 0, DateTimeKind.Utc),
                LockDeadline = new DateTime(2026, 3, 28, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = true,
            },
        };

        _mockRaceWeekendService
            .Setup(x => x.GetRaceWeekendsBySeasonAsync(seasonId))
            .ReturnsAsync(raceWeekends);

        // Act
        var result = await InvokeGetRaceWeekendsBySeasonAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceWeekendResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceWeekendResponse>>)result;
        Assert.Equal(2, okResult.Value!.Count());
    }

    [Fact]
    public async Task GetRaceWeekendsBySeasonAsync_ReturnsOk_WhenNoRaceWeekendsExist()
    {
        // Arrange
        var seasonId = 999;
        var emptyList = new List<RaceWeekendResponse>();

        _mockRaceWeekendService
            .Setup(x => x.GetRaceWeekendsBySeasonAsync(seasonId))
            .ReturnsAsync(emptyList);

        // Act
        var result = await InvokeGetRaceWeekendsBySeasonAsync(seasonId);

        // Assert
        Assert.IsType<Ok<IEnumerable<RaceWeekendResponse>>>(result);
        var okResult = (Ok<IEnumerable<RaceWeekendResponse>>)result;
        Assert.Empty(okResult.Value!);
    }

    #endregion

    #region GetRaceWeekendByRoundAsync Tests

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_ReturnsOk_WhenRaceWeekendExists()
    {
        // Arrange
        var seasonId = 1;
        var round = 5;
        var raceWeekend = new RaceWeekendResponse
        {
            Id = 5,
            SeasonId = seasonId,
            Round = round,
            Name = "Monaco Grand Prix",
            Circuit = CreateCircuit("Circuit de Monaco", "Monte Carlo", "Monaco"),
            RaceDate = new DateTime(2026, 5, 24, 0, 0, 0, DateTimeKind.Utc),
            LockDeadline = new DateTime(2026, 5, 23, 12, 0, 0, DateTimeKind.Utc),
            IsCurrent = true,
        };

        _mockRaceWeekendService
            .Setup(x => x.GetRaceWeekendByRoundAsync(seasonId, round))
            .ReturnsAsync(raceWeekend);

        // Act
        var result = await InvokeGetRaceWeekendByRoundAsync(seasonId, round);

        // Assert
        Assert.IsType<Ok<RaceWeekendResponse>>(result);
        var okResult = (Ok<RaceWeekendResponse>)result;
        Assert.Equal(5, okResult.Value!.Id);
        Assert.Equal("Monaco Grand Prix", okResult.Value!.Name);
    }

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_Returns404_WhenRaceWeekendDoesNotExist()
    {
        // Arrange
        var seasonId = 1;
        var round = 999;

        _mockRaceWeekendService
            .Setup(x => x.GetRaceWeekendByRoundAsync(seasonId, round))
            .ReturnsAsync((RaceWeekendResponse?)null);

        // Act
        var result = await InvokeGetRaceWeekendByRoundAsync(seasonId, round);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
        Assert.Equal("Race weekend not found", problemResult.ProblemDetails.Detail);
    }

    [Fact]
    public async Task GetRaceWeekendByRoundAsync_ReturnsOk_WithNullLockDeadline()
    {
        // Arrange
        var seasonId = 1;
        var round = 10;
        var raceWeekend = new RaceWeekendResponse
        {
            Id = 10,
            SeasonId = seasonId,
            Round = round,
            Name = "British Grand Prix",
            Circuit = CreateCircuit("Silverstone Circuit", "Silverstone", "United Kingdom"),
            RaceDate = new DateTime(2026, 7, 5, 0, 0, 0, DateTimeKind.Utc),
            LockDeadline = null,
            IsCurrent = false,
        };

        _mockRaceWeekendService
            .Setup(x => x.GetRaceWeekendByRoundAsync(seasonId, round))
            .ReturnsAsync(raceWeekend);

        // Act
        var result = await InvokeGetRaceWeekendByRoundAsync(seasonId, round);

        // Assert
        Assert.IsType<Ok<RaceWeekendResponse>>(result);
        var okResult = (Ok<RaceWeekendResponse>)result;
        Assert.Equal(10, okResult.Value!.Id);
        Assert.Null(okResult.Value!.LockDeadline);
    }

    #endregion

    #region Helper Methods

    private async Task<IResult> InvokeGetRaceWeekendsBySeasonAsync(int seasonId)
    {
        var method = typeof(RaceWeekendEndpoints).GetMethod(
            "GetRaceWeekendsBySeasonAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[] { _mockRaceWeekendService.Object, seasonId, _mockLogger.Object }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetRaceWeekendByRoundAsync(int seasonId, int round)
    {
        var method = typeof(RaceWeekendEndpoints).GetMethod(
            "GetRaceWeekendByRoundAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        seasonId,
                        round,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    #endregion
}
