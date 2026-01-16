using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class EntityAlreadyOnTeamExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int entityId = 10;
        const string entityType = "driver";
        const int teamId = 100;

        // Act
        var exception = new EntityAlreadyOnTeamException(entityId, entityType, teamId);

        // Assert
        Assert.Equal(entityId, exception.EntityId);
        Assert.Equal(entityType, exception.EntityType);
        Assert.Equal(teamId, exception.TeamId);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int entityId = 25;
        const string entityType = "driver";
        const int teamId = 250;

        // Act
        var exception = new EntityAlreadyOnTeamException(entityId, entityType, teamId);

        // Assert
        Assert.Contains(entityId.ToString(), exception.Message);
        Assert.Contains("Driver", exception.Message); // Capitalized in message
        Assert.Contains(teamId.ToString(), exception.Message);
        Assert.Contains("already on team", exception.Message);
    }
}
