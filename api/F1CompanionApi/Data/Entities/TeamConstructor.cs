using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a constructor selection on a fantasy team with slot position tracking.
/// Tracks who added the constructor and when for audit trail purposes.
/// </summary>
[Index(nameof(TeamId), nameof(SlotPosition), IsUnique = true)]
[Index(nameof(TeamId), nameof(ConstructorId), IsUnique = true)]
public class TeamConstructor : UserOwnedEntity
{
    public int TeamId { get; set; }
    public int ConstructorId { get; set; }
    public int SlotPosition { get; set; }

    public Team Team { get; set; } = null!;
    public Constructor Constructor { get; set; } = null!;
}
