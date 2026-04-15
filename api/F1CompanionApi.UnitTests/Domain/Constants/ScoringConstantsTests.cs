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
        Assert.Equal(
            expectedPoints,
            ScoringConstants.QualifyingPositionPoints.GetValueOrDefault(position)
        );
    }

    [Theory]
    [InlineData(1, 8)]
    [InlineData(8, 1)]
    [InlineData(9, 0)]
    public void SprintPositionPoints_ReturnsCorrectPoints(int position, int expectedPoints)
    {
        Assert.Equal(
            expectedPoints,
            ScoringConstants.SprintPositionPoints.GetValueOrDefault(position)
        );
    }

    [Theory]
    [InlineData(1, 25)]
    [InlineData(10, 1)]
    [InlineData(11, 0)]
    public void GrandPrixPositionPoints_ReturnsCorrectPoints(int position, int expectedPoints)
    {
        Assert.Equal(
            expectedPoints,
            ScoringConstants.GrandPrixPositionPoints.GetValueOrDefault(position)
        );
    }

    [Fact]
    public void GrandPrixPositionPoints_OutOfRangePosition_ReturnsZero()
    {
        Assert.Equal(0, ScoringConstants.GrandPrixPositionPoints.GetValueOrDefault(0));
        Assert.Equal(0, ScoringConstants.GrandPrixPositionPoints.GetValueOrDefault(-1));
    }
}
