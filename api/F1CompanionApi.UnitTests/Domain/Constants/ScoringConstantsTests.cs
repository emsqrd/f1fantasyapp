using F1CompanionApi.Domain.Constants;

namespace F1CompanionApi.UnitTests.Domain.Constants;

public class ScoringConstantsTests
{
    [Theory]
    [InlineData(1, 10)]
    [InlineData(10, 1)]
    [InlineData(11, 0)]
    public void QualifyingPositionPoints_ReturnsCorrectPoints(int position, int expectedPoints)
    {
        var points = ScoringConstants.GetPositionPoints(
            ScoringConstants.QualifyingPositionPoints,
            position
        );
        Assert.Equal(expectedPoints, points);
    }

    [Theory]
    [InlineData(1, 8)]
    [InlineData(8, 1)]
    [InlineData(9, 0)]
    public void SprintPositionPoints_ReturnsCorrectPoints(int position, int expectedPoints)
    {
        var points = ScoringConstants.GetPositionPoints(
            ScoringConstants.SprintPositionPoints,
            position
        );
        Assert.Equal(expectedPoints, points);
    }

    [Theory]
    [InlineData(1, 25)]
    [InlineData(10, 1)]
    [InlineData(11, 0)]
    public void RacePositionPoints_ReturnsCorrectPoints(int position, int expectedPoints)
    {
        var points = ScoringConstants.GetPositionPoints(
            ScoringConstants.RacePositionPoints,
            position
        );
        Assert.Equal(expectedPoints, points);
    }

    [Fact]
    public void GetPositionPoints_OutOfRangePosition_ReturnsZero()
    {
        Assert.Equal(0, ScoringConstants.GetPositionPoints(ScoringConstants.RacePositionPoints, 0));
        Assert.Equal(
            0,
            ScoringConstants.GetPositionPoints(ScoringConstants.RacePositionPoints, -1)
        );
    }
}
