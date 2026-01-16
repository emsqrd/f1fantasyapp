namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when a user attempts to modify a team they do not own.
/// This is considered exceptional because it indicates an authorization violation,
/// potentially a malicious attempt to bypass security controls.
/// </summary>
public class TeamOwnershipException : Exception
{
    /// <summary>
    /// Gets the ID of the team that was attempted to be modified.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Gets the ID of the actual owner of the team.
    /// </summary>
    public int OwnerId { get; init; }

    /// <summary>
    /// Gets the ID of the user who attempted to modify the team.
    /// </summary>
    public int AttemptedUserId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="TeamOwnershipException"/> class.
    /// </summary>
    /// <param name="teamId">The ID of the team that was attempted to be modified.</param>
    /// <param name="ownerId">The ID of the actual owner of the team.</param>
    /// <param name="attemptedUserId">The ID of the user who attempted to modify the team.</param>
    public TeamOwnershipException(int teamId, int ownerId, int attemptedUserId)
        : base($"User {attemptedUserId} cannot modify team {teamId} owned by user {ownerId}")
    {
        TeamId = teamId;
        OwnerId = ownerId;
        AttemptedUserId = attemptedUserId;
    }
}
