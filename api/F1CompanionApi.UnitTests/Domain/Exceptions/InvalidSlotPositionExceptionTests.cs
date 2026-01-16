using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class InvalidSlotPositionExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int position = 5;
        const int maxPosition = 4;
        const string entityType = "driver";

        // Act
        var exception = new InvalidSlotPositionException(position, maxPosition, entityType);

        // Assert
        Assert.Equal(position, exception.Position);
        Assert.Equal(maxPosition, exception.MaxPosition);
        Assert.Equal(entityType, exception.EntityType);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int position = 6;
        const int maxPosition = 4;
        const string entityType = "driver";

        // Act
        var exception = new InvalidSlotPositionException(position, maxPosition, entityType);

        // Assert
        Assert.Contains(position.ToString(), exception.Message);
        Assert.Contains(maxPosition.ToString(), exception.Message);
        Assert.Contains("drivers", exception.Message); // Pluralized in message
        Assert.Contains("invalid", exception.Message);
    }
}
