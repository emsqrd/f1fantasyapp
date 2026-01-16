namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to assign a driver or constructor to an already occupied slot.
/// This is considered exceptional because the UI should prevent users from selecting occupied slots,
/// indicating either a race condition or a client-side bug.
/// </summary>
public class SlotOccupiedException : Exception
{
    /// <summary>
    /// Gets the position of the slot that is already occupied.
    /// </summary>
    public int Position { get; init; }

    /// <summary>
    /// Gets the ID of the team containing the occupied slot.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="SlotOccupiedException"/> class.
    /// </summary>
    /// <param name="position">The position of the slot that is already occupied.</param>
    /// <param name="teamId">The ID of the team containing the occupied slot.</param>
    public SlotOccupiedException(int position, int teamId)
        : base($"Slot position {position} is already occupied on team {teamId}")
    {
        Position = position;
        TeamId = teamId;
    }
}
