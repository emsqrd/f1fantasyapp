namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when an invalid slot position is provided for a driver or constructor.
/// This is considered exceptional because slot positions should be validated on the client side,
/// indicating a client-side bug or malicious request.
/// </summary>
public class InvalidSlotPositionException : Exception
{
    /// <summary>
    /// Gets the invalid position that was provided.
    /// </summary>
    public int Position { get; init; }

    /// <summary>
    /// Gets the maximum valid position for this entity type.
    /// </summary>
    public int MaxPosition { get; init; }

    /// <summary>
    /// Gets the type of entity (e.g., "driver" or "constructor").
    /// </summary>
    public string EntityType { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidSlotPositionException"/> class.
    /// </summary>
    /// <param name="position">The invalid position that was provided.</param>
    /// <param name="maxPosition">The maximum valid position for this entity type.</param>
    /// <param name="entityType">The type of entity (e.g., "driver" or "constructor").</param>
    public InvalidSlotPositionException(int position, int maxPosition, string entityType)
        : base($"Slot position {position} is invalid for {entityType}s. Position must be between 0 and {maxPosition}.")
    {
        Position = position;
        MaxPosition = maxPosition;
        EntityType = entityType;
    }
}
