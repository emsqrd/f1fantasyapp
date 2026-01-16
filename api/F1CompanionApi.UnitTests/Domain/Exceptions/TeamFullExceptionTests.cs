using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class TeamFullExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int teamId = 10;
        const int maxSlots = 5;
        const string entityType = "driver";

        // Act
        var exception = new TeamFullException(teamId, maxSlots, entityType);

        // Assert
        Assert.Equal(teamId, exception.TeamId);
        Assert.Equal(maxSlots, exception.MaxSlots);
        Assert.Equal(entityType, exception.EntityType);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int teamId = 20;
        const int maxSlots = 5;
        const string entityType = "driver";

        // Act
        var exception = new TeamFullException(teamId, maxSlots, entityType);

        // Assert
        Assert.Contains(teamId.ToString(), exception.Message);
        Assert.Contains(maxSlots.ToString(), exception.Message);
        Assert.Contains("driver", exception.Message);
        Assert.Contains("cannot have more than", exception.Message);
    }
}
