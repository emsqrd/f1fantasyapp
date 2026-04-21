using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class RaceWeekendScoringEndpointsTests
{
    private readonly Mock<IRaceWeekendService> _mockRaceWeekendService;
    private readonly Mock<IScoringService> _mockScoringService;

    private const int SeasonId = 1;
    private const int Round = 1;
    private const int RaceWeekendId = 10;

    public RaceWeekendScoringEndpointsTests()
    {
        _mockRaceWeekendService = new Mock<IRaceWeekendService>();
        _mockScoringService = new Mock<IScoringService>();

        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, Round))
            .ReturnsAsync(RaceWeekendId);
    }

    [Fact]
    public async Task ScoreRaceWeekendAsync_Returns404_WhenRaceWeekendNotFound()
    {
        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, 99))
            .ReturnsAsync((int?)null);

        var result = await InvokeScoreRaceWeekendAsync(SeasonId, 99);

        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, problem.StatusCode);
        _mockScoringService.Verify(x => x.ScoreRaceWeekendAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task ScoreRaceWeekendAsync_ReturnsNoContent_OnSuccess()
    {
        _mockScoringService
            .Setup(x => x.ScoreRaceWeekendAsync(RaceWeekendId))
            .Returns(Task.CompletedTask);

        var result = await InvokeScoreRaceWeekendAsync(SeasonId, Round);

        Assert.IsType<NoContent>(result);
        _mockScoringService.Verify(x => x.ScoreRaceWeekendAsync(RaceWeekendId), Times.Once);
    }

    private async Task<IResult> InvokeScoreRaceWeekendAsync(int seasonId, int round)
    {
        var method = typeof(RaceWeekendScoringEndpoints).GetMethod(
            "ScoreRaceWeekendAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockScoringService.Object,
                        seasonId,
                        round,
                    }
                )!;

        return await task;
    }
}
