using F1CompanionApi.Domain.Exceptions;
using Xunit;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class UserProfileNotFoundExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const string accountId = "test-account-123";

        // Act
        var exception = new UserProfileNotFoundException(accountId);

        // Assert
        Assert.Equal(accountId, exception.AccountId);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const string accountId = "test-account-456";

        // Act
        var exception = new UserProfileNotFoundException(accountId);

        // Assert
        Assert.Contains(accountId, exception.Message);
        Assert.Contains("User profile not found", exception.Message);
    }
}
