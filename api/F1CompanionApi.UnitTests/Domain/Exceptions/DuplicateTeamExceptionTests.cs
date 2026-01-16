using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class DuplicateTeamExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int userId = 10;
        const int existingTeamId = 100;

        // Act
        var exception = new DuplicateTeamException(userId, existingTeamId);

        // Assert
        Assert.Equal(userId, exception.UserId);
        Assert.Equal(existingTeamId, exception.ExistingTeamId);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int userId = 25;
        const int existingTeamId = 250;

        // Act
        var exception = new DuplicateTeamException(userId, existingTeamId);

        // Assert
        Assert.Contains(userId.ToString(), exception.Message);
        Assert.Contains(existingTeamId.ToString(), exception.Message);
        Assert.Contains("already has a team", exception.Message);
    }
}
