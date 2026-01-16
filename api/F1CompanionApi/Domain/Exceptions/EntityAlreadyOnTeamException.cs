namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to add a driver or constructor that is already on the team.
/// This is considered exceptional because the UI should disable already-selected items,
/// indicating a client-side validation failure.
/// </summary>
public class EntityAlreadyOnTeamException : Exception
{
    /// <summary>
    /// Gets the ID of the entity (driver or constructor) that is already on the team.
    /// </summary>
    public int EntityId { get; init; }

    /// <summary>
    /// Gets the type of entity (e.g., "driver" or "constructor").
    /// </summary>
    public string EntityType { get; init; }

    /// <summary>
    /// Gets the ID of the team that already contains this entity.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="EntityAlreadyOnTeamException"/> class.
    /// </summary>
    /// <param name="entityId">The ID of the entity that is already on the team.</param>
    /// <param name="entityType">The type of entity (e.g., "driver" or "constructor").</param>
    /// <param name="teamId">The ID of the team that already contains this entity.</param>
    public EntityAlreadyOnTeamException(int entityId, string entityType, int teamId)
        : base($"{char.ToUpper(entityType[0])}{entityType[1..]} {entityId} is already on team {teamId}")
    {
        EntityId = entityId;
        EntityType = entityType;
        TeamId = teamId;
    }
}
