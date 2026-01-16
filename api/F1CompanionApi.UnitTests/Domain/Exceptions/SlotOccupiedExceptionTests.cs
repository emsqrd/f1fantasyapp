using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class SlotOccupiedExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int position = 2;
        const int teamId = 100;

        // Act
        var exception = new SlotOccupiedException(position, teamId);

        // Assert
        Assert.Equal(position, exception.Position);
        Assert.Equal(teamId, exception.TeamId);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int position = 3;
        const int teamId = 200;

        // Act
        var exception = new SlotOccupiedException(position, teamId);

        // Assert
        Assert.Contains(position.ToString(), exception.Message);
        Assert.Contains(teamId.ToString(), exception.Message);
        Assert.Contains("already occupied", exception.Message);
    }
}
