using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class LineupEndpointsTests
{
    private readonly Mock<IRaceWeekendService> _mockRaceWeekendService;
    private readonly Mock<ILineupService> _mockLineupService;

    private const int SeasonId = 1;
    private const int Round = 1;
    private const int RaceWeekendId = 10;

    public LineupEndpointsTests()
    {
        _mockRaceWeekendService = new Mock<IRaceWeekendService>();
        _mockLineupService = new Mock<ILineupService>();

        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, Round))
            .ReturnsAsync(RaceWeekendId);
    }

    [Fact]
    public async Task AdvanceLineupsAsync_Returns404_WhenRaceWeekendNotFound()
    {
        _mockRaceWeekendService
            .Setup(x => x.GetIdByRoundAsync(SeasonId, 99))
            .ReturnsAsync((int?)null);

        var result = await InvokeAdvanceLineupsAsync(SeasonId, 99);

        var problem = Assert.IsType<ProblemHttpResult>(result);
        Assert.Equal(StatusCodes.Status404NotFound, problem.StatusCode);
        _mockLineupService.Verify(x => x.AdvanceLineupAsync(It.IsAny<int>()), Times.Never);
    }

    [Fact]
    public async Task AdvanceLineupsAsync_ReturnsNoContent_OnSuccess()
    {
        _mockLineupService
            .Setup(x => x.AdvanceLineupAsync(RaceWeekendId))
            .Returns(Task.CompletedTask);

        var result = await InvokeAdvanceLineupsAsync(SeasonId, Round);

        Assert.IsType<NoContent>(result);
        _mockLineupService.Verify(x => x.AdvanceLineupAsync(RaceWeekendId), Times.Once);
    }

    [Fact]
    public async Task AdvanceLineupsAsync_BubblesNextRoundLockedException()
    {
        _mockLineupService
            .Setup(x => x.AdvanceLineupAsync(RaceWeekendId))
            .ThrowsAsync(new NextRoundLockedException(nextRound: 2, lockedAt: DateTime.UtcNow));

        await Assert.ThrowsAsync<NextRoundLockedException>(() =>
            InvokeAdvanceLineupsAsync(SeasonId, Round)
        );
    }

    private async Task<IResult> InvokeAdvanceLineupsAsync(int seasonId, int round)
    {
        var method = typeof(LineupEndpoints).GetMethod(
            "AdvanceLineupsAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task =
            (Task<IResult>)
                method!.Invoke(
                    null,
                    new object[]
                    {
                        _mockRaceWeekendService.Object,
                        _mockLineupService.Object,
                        seasonId,
                        round,
                    }
                )!;

        return await task;
    }
}
