using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class TeamOwnershipExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int teamId = 10;
        const int ownerId = 20;
        const int attemptedUserId = 30;

        // Act
        var exception = new TeamOwnershipException(teamId, ownerId, attemptedUserId);

        // Assert
        Assert.Equal(teamId, exception.TeamId);
        Assert.Equal(ownerId, exception.OwnerId);
        Assert.Equal(attemptedUserId, exception.AttemptedUserId);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int teamId = 15;
        const int ownerId = 25;
        const int attemptedUserId = 35;

        // Act
        var exception = new TeamOwnershipException(teamId, ownerId, attemptedUserId);

        // Assert
        Assert.Contains(teamId.ToString(), exception.Message);
        Assert.Contains(ownerId.ToString(), exception.Message);
        Assert.Contains(attemptedUserId.ToString(), exception.Message);
        Assert.Contains("cannot modify team", exception.Message);
    }
}
