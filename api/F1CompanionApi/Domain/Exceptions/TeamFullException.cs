namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to add more drivers or constructors than allowed to a team.
/// This is considered exceptional because the UI should disable the "Add" button when the team is full,
/// indicating a client-side validation failure.
/// </summary>
public class TeamFullException : Exception
{
    /// <summary>
    /// Gets the ID of the team that is full.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Gets the maximum number of slots allowed for this entity type.
    /// </summary>
    public int MaxSlots { get; init; }

    /// <summary>
    /// Gets the type of entity (e.g., "driver" or "constructor").
    /// </summary>
    public string EntityType { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="TeamFullException"/> class.
    /// </summary>
    /// <param name="teamId">The ID of the team that is full.</param>
    /// <param name="maxSlots">The maximum number of slots allowed for this entity type.</param>
    /// <param name="entityType">The type of entity (e.g., "driver" or "constructor").</param>
    public TeamFullException(int teamId, int maxSlots, string entityType)
        : base($"Team {teamId} cannot have more than {maxSlots} {entityType}s")
    {
        TeamId = teamId;
        MaxSlots = maxSlots;
        EntityType = entityType;
    }
}
