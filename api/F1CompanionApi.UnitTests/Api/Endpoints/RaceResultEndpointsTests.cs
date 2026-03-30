using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class RaceResultEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<IRaceResultService> _mockRaceResultService;

    public RaceResultEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockRaceResultService = new Mock<IRaceResultService>();
    }

    #region SubmitQualifyingResultsAsync Tests

    [Fact]
    public async Task SubmitQualifyingResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 1;
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
                RaceId = raceId,
                Position = 1,
            },
            new DriverQualifyingResultResponse
            {
                Id = 2,
                DriverId = 2,
                RaceId = raceId,
                Position = 2,
            },
        };

        _mockRaceResultService
            .Setup(x => x.SubmitQualifyingResultsAsync(raceId, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitQualifyingResultsAsync(raceId, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverQualifyingResultResponse>>>(result);
        _mockRaceResultService.Verify(
            x => x.SubmitQualifyingResultsAsync(raceId, items),
            Times.Once
        );
    }

    #endregion

    #region GetQualifyingResultsAsync Tests

    [Fact]
    public async Task GetQualifyingResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 1;
        var expected = new List<DriverQualifyingResultResponse>
        {
            new DriverQualifyingResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceId = raceId,
                Position = 1,
            },
        };

        _mockRaceResultService
            .Setup(x => x.GetQualifyingResultsAsync(raceId))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetQualifyingResultsAsync(raceId);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverQualifyingResultResponse>>>(result);
    }

    #endregion

    #region SubmitRaceResultsAsync Tests

    [Fact]
    public async Task SubmitRaceResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 1;
        var items = new List<RaceResultItem>
        {
            new RaceResultItem
            {
                DriverId = 1,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RaceStatus.Classified,
            },
        };
        var expected = new List<DriverRaceResultResponse>
        {
            new DriverRaceResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceId = raceId,
                SessionType = SessionType.Race,
                GridPosition = 1,
                FinishPosition = 1,
                Overtakes = 0,
                FastestLap = true,
                Status = RaceStatus.Classified,
            },
        };

        _mockRaceResultService
            .Setup(x => x.SubmitRaceResultsAsync(raceId, SessionType.Race, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitRaceResultsAsync(raceId, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRaceResultResponse>>>(result);
        _mockRaceResultService.Verify(
            x => x.SubmitRaceResultsAsync(raceId, SessionType.Race, items),
            Times.Once
        );
    }

    #endregion

    #region GetRaceResultsAsync Tests

    [Fact]
    public async Task GetRaceResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 1;
        var expected = new List<DriverRaceResultResponse>
        {
            new DriverRaceResultResponse
            {
                Id = 1,
                DriverId = 1,
                RaceId = raceId,
                SessionType = SessionType.Race,
                GridPosition = 3,
                FinishPosition = 1,
                Overtakes = 2,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
        };

        _mockRaceResultService
            .Setup(x => x.GetRaceResultsAsync(raceId, SessionType.Race))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetRaceResultsAsync(raceId);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRaceResultResponse>>>(result);
        _mockRaceResultService.Verify(
            x => x.GetRaceResultsAsync(raceId, SessionType.Race),
            Times.Once
        );
    }

    #endregion

    #region SubmitSprintResultsAsync Tests

    [Fact]
    public async Task SubmitSprintResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 2;
        var items = new List<RaceResultItem>
        {
            new RaceResultItem
            {
                DriverId = 5,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
        };
        var expected = new List<DriverRaceResultResponse>
        {
            new DriverRaceResultResponse
            {
                Id = 10,
                DriverId = 5,
                RaceId = raceId,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
        };

        _mockRaceResultService
            .Setup(x => x.SubmitRaceResultsAsync(raceId, SessionType.Sprint, items))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeSubmitSprintResultsAsync(raceId, items);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRaceResultResponse>>>(result);
        _mockRaceResultService.Verify(
            x => x.SubmitRaceResultsAsync(raceId, SessionType.Sprint, items),
            Times.Once
        );
    }

    #endregion

    #region GetSprintResultsAsync Tests

    [Fact]
    public async Task GetSprintResultsAsync_ReturnsOk_WithResults()
    {
        // Arrange
        var raceId = 2;
        var expected = new List<DriverRaceResultResponse>
        {
            new DriverRaceResultResponse
            {
                Id = 10,
                DriverId = 5,
                RaceId = raceId,
                SessionType = SessionType.Sprint,
                GridPosition = 2,
                FinishPosition = 2,
                Overtakes = 1,
                FastestLap = false,
                Status = RaceStatus.Classified,
            },
        };

        _mockRaceResultService
            .Setup(x => x.GetRaceResultsAsync(raceId, SessionType.Sprint))
            .ReturnsAsync(expected);

        // Act
        var result = await InvokeGetSprintResultsAsync(raceId);

        // Assert
        Assert.IsType<Ok<IEnumerable<DriverRaceResultResponse>>>(result);
        _mockRaceResultService.Verify(
            x => x.GetRaceResultsAsync(raceId, SessionType.Sprint),
            Times.Once
        );
    }

    #endregion

    #region Helper Methods

    private async Task<IResult> InvokeSubmitQualifyingResultsAsync(
        int raceId,
        List<QualifyingResultItem> items
    )
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "SubmitQualifyingResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceResultService.Object,
                        raceId,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetQualifyingResultsAsync(int raceId)
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "GetQualifyingResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[] { _mockRaceResultService.Object, raceId, _mockLogger.Object }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeSubmitRaceResultsAsync(int raceId, List<RaceResultItem> items)
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "SubmitRaceResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceResultService.Object,
                        raceId,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetRaceResultsAsync(int raceId)
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "GetRaceResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[] { _mockRaceResultService.Object, raceId, _mockLogger.Object }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeSubmitSprintResultsAsync(
        int raceId,
        List<RaceResultItem> items
    )
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "SubmitSprintResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceResultService.Object,
                        raceId,
                        items,
                        _mockLogger.Object,
                    }
                )!;

        return await task;
    }

    private async Task<IResult> InvokeGetSprintResultsAsync(int raceId)
    {
        var method = typeof(RaceResultEndpoints).GetMethod(
            "GetSprintResultsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[] { _mockRaceResultService.Object, raceId, _mockLogger.Object }
                )!;

        return await task;
    }

    #endregion
}
