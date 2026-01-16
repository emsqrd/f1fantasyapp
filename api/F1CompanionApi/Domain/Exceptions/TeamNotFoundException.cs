namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when a user's team cannot be found.
/// This is considered exceptional because a team should exist before certain operations like league creation.
/// Indicates a data integrity issue that requires investigation.
/// </summary>
public class TeamNotFoundException : Exception
{
    /// <summary>
    /// Gets the user ID whose team was not found.
    /// </summary>
    public int UserId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="TeamNotFoundException"/> class.
    /// </summary>
    /// <param name="userId">The user ID whose team was not found.</param>
    public TeamNotFoundException(int userId)
        : base($"Team not found for user {userId}")
    {
        UserId = userId;
    }
}
