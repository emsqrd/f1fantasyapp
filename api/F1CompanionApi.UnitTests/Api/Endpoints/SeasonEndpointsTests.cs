using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class SeasonEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<ISeasonService> _mockSeasonService;

    public SeasonEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockSeasonService = new Mock<ISeasonService>();
    }

    #region GetSeasonsAsync Tests

    [Fact]
    public async Task GetSeasonsAsync_ReturnsOk_WhenSeasonsExist()
    {
        // Arrange
        var seasons = new List<SeasonResponse>
        {
            new SeasonResponse
            {
                Id = 1,
                Year = 2023,
                StartDate = new DateTime(2023, 3, 5, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2023, 11, 26, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = false
            },
            new SeasonResponse
            {
                Id = 2,
                Year = 2024,
                StartDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc),
                IsCurrent = true
            }
        };

        _mockSeasonService.Setup(x => x.GetSeasonsAsync())
            .ReturnsAsync(seasons);

        // Act
        var result = await InvokeGetSeasonsAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<SeasonResponse>>>(result);
        var okResult = (Ok<IEnumerable<SeasonResponse>>)result;
        Assert.Equal(2, okResult.Value!.Count());
    }

    [Fact]
    public async Task GetSeasonsAsync_ReturnsOk_WhenNoSeasonsExist()
    {
        // Arrange
        var emptySeasons = new List<SeasonResponse>();

        _mockSeasonService.Setup(x => x.GetSeasonsAsync())
            .ReturnsAsync(emptySeasons);

        // Act
        var result = await InvokeGetSeasonsAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<SeasonResponse>>>(result);
        var okResult = (Ok<IEnumerable<SeasonResponse>>)result;
        Assert.Empty(okResult.Value!);
    }

    #endregion

    #region GetSeasonByIdAsync Tests

    [Fact]
    public async Task GetSeasonByIdAsync_ReturnsOk_WhenSeasonExists()
    {
        // Arrange
        var season = new SeasonResponse
        {
            Id = 1,
            Year = 2024,
            StartDate = new DateTime(2024, 3, 2, 0, 0, 0, DateTimeKind.Utc),
            EndDate = new DateTime(2024, 12, 8, 0, 0, 0, DateTimeKind.Utc),
            IsCurrent = true
        };

        _mockSeasonService.Setup(x => x.GetSeasonByIdAsync(1))
            .ReturnsAsync(season);

        // Act
        var result = await InvokeGetSeasonByIdAsync(1);

        // Assert
        Assert.IsType<Ok<SeasonResponse>>(result);
        var okResult = (Ok<SeasonResponse>)result;
        Assert.Equal(1, okResult.Value!.Id);
    }

    [Fact]
    public async Task GetSeasonByIdAsync_Returns404_WhenSeasonDoesNotExist()
    {
        // Arrange
        _mockSeasonService.Setup(x => x.GetSeasonByIdAsync(999))
            .ReturnsAsync((SeasonResponse?)null);

        // Act
        var result = await InvokeGetSeasonByIdAsync(999);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
        Assert.Equal("Season not found", problemResult.ProblemDetails.Detail);
    }

    #endregion

    #region Helper Methods

    private async Task<IResult> InvokeGetSeasonsAsync()
    {
        var method = typeof(SeasonEndpoints).GetMethod(
            "GetSeasonsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockSeasonService.Object, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetSeasonByIdAsync(int id)
    {
        var method = typeof(SeasonEndpoints).GetMethod(
            "GetSeasonByIdAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockSeasonService.Object, id, _mockLogger.Object }
        )!;

        return await task;
    }

    #endregion
}
