using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a driver selection on a fantasy team with slot position tracking.
/// Tracks who added the driver and when for audit trail purposes.
/// </summary>
[Index(nameof(TeamId), nameof(SlotPosition), IsUnique = true)]
[Index(nameof(TeamId), nameof(DriverId), IsUnique = true)]
public class TeamDriver : UserOwnedEntity
{
    public int TeamId { get; set; }
    public int DriverId { get; set; }
    public int SlotPosition { get; set; }

    public Team Team { get; set; } = null!;
    public Driver Driver { get; set; } = null!;
}
