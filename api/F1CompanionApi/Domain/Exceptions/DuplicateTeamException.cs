namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when a user attempts to create a second team.
/// This is considered exceptional because the UI should prevent team creation when a user already has a team,
/// and business rules enforce one team per user.
/// </summary>
public class DuplicateTeamException : Exception
{
    /// <summary>
    /// Gets the ID of the user who attempted to create a duplicate team.
    /// </summary>
    public int UserId { get; init; }

    /// <summary>
    /// Gets the ID of the existing team that the user already owns.
    /// </summary>
    public int ExistingTeamId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="DuplicateTeamException"/> class.
    /// </summary>
    /// <param name="userId">The ID of the user who attempted to create a duplicate team.</param>
    /// <param name="existingTeamId">The ID of the existing team that the user already owns.</param>
    public DuplicateTeamException(int userId, int existingTeamId)
        : base($"User {userId} already has a team (ID: {existingTeamId}). Each user can only create one team.")
    {
        UserId = userId;
        ExistingTeamId = existingTeamId;
    }
}
