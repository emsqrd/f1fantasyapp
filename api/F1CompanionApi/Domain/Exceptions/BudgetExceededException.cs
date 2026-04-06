using F1CompanionApi.Domain.Constants;

namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when adding a player would push a team over the budget cap.
/// </summary>
public class BudgetExceededException : Exception
{
    /// <summary>
    /// Gets the ID of the team that cannot afford the player.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Gets the price of the player that was attempted to be added.
    /// </summary>
    public decimal PlayerPrice { get; init; }

    /// <summary>
    /// Gets the remaining budget before the attempted addition.
    /// </summary>
    public decimal RemainingBudget { get; init; }

    public BudgetExceededException(int teamId, decimal playerPrice, decimal remainingBudget)
        : base(
            $"Team {teamId} cannot afford this player. Cost: {playerPrice:C0}, Remaining: {remainingBudget:C0}, Cap: {BudgetConstants.BudgetCap:C0}"
        )
    {
        TeamId = teamId;
        PlayerPrice = playerPrice;
        RemainingBudget = remainingBudget;
    }
}
