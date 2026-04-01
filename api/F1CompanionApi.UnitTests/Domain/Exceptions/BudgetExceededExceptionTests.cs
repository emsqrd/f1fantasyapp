using F1CompanionApi.Domain.Constants;
using F1CompanionApi.Domain.Exceptions;

namespace F1CompanionApi.UnitTests.Domain.Exceptions;

public class BudgetExceededExceptionTests
{
    [Fact]
    public void Constructor_SetsAllPropertiesCorrectly()
    {
        // Arrange
        const int teamId = 42;
        const decimal playerPrice = 25_000_000m;
        const decimal remainingBudget = 10_000_000m;

        // Act
        var exception = new BudgetExceededException(teamId, playerPrice, remainingBudget);

        // Assert
        Assert.Equal(teamId, exception.TeamId);
        Assert.Equal(playerPrice, exception.PlayerPrice);
        Assert.Equal(remainingBudget, exception.RemainingBudget);
    }

    [Fact]
    public void Constructor_FormatsMessageWithCriticalContext()
    {
        // Arrange
        const int teamId = 42;
        const decimal playerPrice = 25_000_000m;
        const decimal remainingBudget = 10_000_000m;

        // Act
        var exception = new BudgetExceededException(teamId, playerPrice, remainingBudget);

        // Assert
        Assert.Contains(teamId.ToString(), exception.Message);
        Assert.Contains("cannot afford", exception.Message);
        Assert.Contains(BudgetConstants.BudgetCap.ToString("C0"), exception.Message);
    }
}
