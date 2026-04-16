using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class RaceWeekendResultEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<IRaceWeekendService> _mockRaceWeekendService;
    private readonly Mock<IRaceWeekendResultService> _mockRaceWeekendResultService;

    private const int SeasonId = 1;
    private const int Round = 1;
    private const int RaceWeekendId = 10;

    public RaceWeekendResultEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockRaceWeekendService = new Mock<IRaceWeekendService>();
        _mockRaceWeekendResultService = new Mock<IRaceWeekendResultService>();

        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, Round))
            .ReturnsAsync(RaceWeekendId);
    }

    #region SubmitQualifyingResultsAsync Tests

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var items = new List<QualifyingResultItem>
        {
            new QualifyingResultItem { DriverId = 1, Position = 1 },
            new QualifyingResultItem { DriverId = 2, Position = 2 },
        };
        var expected = new List<DriverQualifyingResultResponse>
        {
            new DriverQualifyingResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceWeekendId = RaceWeekendId,
                Position = 1,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.SubmitQualifyingResultsAsync(RaceWeekendId, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitQualifyingResultsAsync(SeasonId, Round, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverQualifyingResultResponse>>>(result);
        _mockRaceWeekendResultService.Verify(
            x => x.SubmitQualifyingResultsAsync(RaceWeekendId, items),
            Times.Once
        );
    }

    [Fact]
    public async Task SubmitQualifyingResultsAsync_Returns404_WhenRaceWeekendNotFound()
    {
        // Arrange
        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, 99))
            .ReturnsAsync((int?)null);

        var items = new List<QualifyingResultItem>
        {
            new QualifyingResultItem { DriverId = 1, Position = 1 },
        };

        // Act
        var result = await InvokeSubmitQualifyingResultsAsync(SeasonId, 99, items);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    #endregion

    #region GetQualifyingResultsAsync Tests

    [Fact]
    public async Task GetQualifyingResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var expected = new List<DriverQualifyingResultResponse>
        {
            new DriverQualifyingResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceWeekendId = RaceWeekendId,
                Position = 1,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.GetQualifyingResultsAsync(RaceWeekendId))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetQualifyingResultsAsync(SeasonId, Round);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverQualifyingResultResponse>>>(result);
    }

    [Fact]
    public async Task GetQualifyingResultsAsync_Returns404_WhenRaceWeekendNotFound()
    {
        // Arrange
        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, 99))
            .ReturnsAsync((int?)null);

        // Act
        var result = await InvokeGetQualifyingResultsAsync(SeasonId, 99);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    #endregion

    #region SubmitSprintResultsAsync Tests

    [Fact]
    public async Task SubmitSprintResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var items = new List<RacingResultItem>
        {
            new RacingResultItem
            {
                DriverId = 5,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
        };
        var expected = new List<DriverRacingResultResponse>
        {
            new DriverRacingResultResponse
            {
                Id = 10,
                DriverId = 5,
                RaceWeekendId = RaceWeekendId,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.SubmitRaceResultsAsync(RaceWeekendId, SessionType.Sprint, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitSprintResultsAsync(SeasonId, Round, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRacingResultResponse>>>(result);
        _mockRaceWeekendResultService.Verify(
            x => x.SubmitRaceResultsAsync(RaceWeekendId, SessionType.Sprint, items),
            Times.Once
        );
    }

    #endregion

    #region GetSprintResultsAsync Tests

    [Fact]
    public async Task GetSprintResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var expected = new List<DriverRacingResultResponse>
        {
            new DriverRacingResultResponse
            {
                Id = 10,
                DriverId = 5,
                RaceWeekendId = RaceWeekendId,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.GetRaceResultsAsync(RaceWeekendId, SessionType.Sprint))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetSprintResultsAsync(SeasonId, Round);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRacingResultResponse>>>(result);
        _mockRaceWeekendResultService.Verify(
            x => x.GetRaceResultsAsync(RaceWeekendId, SessionType.Sprint),
            Times.Once
        );
    }

    #endregion

    #region SubmitGrandPrixResultsAsync Tests

    [Fact]
    public async Task SubmitGrandPrixResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var items = new List<RacingResultItem>
        {
            new RacingResultItem
            {
                DriverId = 1,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RacingStatus.Classified,
            },
        };
        var expected = new List<DriverRacingResultResponse>
        {
            new DriverRacingResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceWeekendId = RaceWeekendId,
                SessionType = SessionType.GrandPrix,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RacingStatus.Classified,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.SubmitRaceResultsAsync(RaceWeekendId, SessionType.GrandPrix, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitGrandPrixResultsAsync(SeasonId, Round, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRacingResultResponse>>>(result);
        _mockRaceWeekendResultService.Verify(
            x => x.SubmitRaceResultsAsync(RaceWeekendId, SessionType.GrandPrix, items),
            Times.Once
        );
    }

    #endregion

    #region GetGrandPrixResultsAsync Tests

    [Fact]
    public async Task GetGrandPrixResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var expected = new List<DriverRacingResultResponse>
        {
            new DriverRacingResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceWeekendId = RaceWeekendId,
                SessionType = SessionType.GrandPrix,
                GridPosition = 3,
                FinishPosition = 1,
                Overtakes = 2,
                FastestLap = false,
                Status = RacingStatus.Classified,
            },
        };

        _mockRaceWeekendResultService
            .Setup(x => x.GetRaceResultsAsync(RaceWeekendId, SessionType.GrandPrix))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetGrandPrixResultsAsync(SeasonId, Round);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRacingResultResponse>>>(result);
        _mockRaceWeekendResultService.Verify(
            x => x.GetRaceResultsAsync(RaceWeekendId, SessionType.GrandPrix),
            Times.Once
        );
    }

    #endregion

    #region Helper Methods

    private async Task<IResult> InvokeSubmitQualifyingResultsAsync(
        int seasonId,
        int round,
        List<QualifyingResultItem> items
    )
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "SubmitQualifyingResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetQualifyingResultsAsync(int seasonId, int round)
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "GetQualifyingResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeSubmitSprintResultsAsync(
        int seasonId,
        int round,
        List<RacingResultItem> items
    )
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "SubmitSprintResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetSprintResultsAsync(int seasonId, int round)
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "GetSprintResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeSubmitGrandPrixResultsAsync(
        int seasonId,
        int round,
        List<RacingResultItem> items
    )
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "SubmitGrandPrixResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetGrandPrixResultsAsync(int seasonId, int round)
    {
        var method = typeof(RaceWeekendResultEndpoints).GetMethod(
            "GetGrandPrixResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockRaceWeekendResultService.Object,
                        seasonId,
                        round,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    #endregion
}
