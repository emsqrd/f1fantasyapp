using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Records a single driver or constructor selection on a fantasy team for a specific race.
/// Written on every add (insert) and deleted on every remove. Always reflects the team's
/// current pre-lock lineup for the upcoming race. Used as the scoring engine input.
/// </summary>
[Index(
    nameof(TeamId),
    nameof(RaceWeekendId),
    nameof(EntityType),
    nameof(SlotPosition),
    IsUnique = true
)]
public class LineupEntry
{
    public int Id { get; set; }
    public int TeamId { get; set; }
    public int RaceWeekendId { get; set; }
    public int EntityId { get; set; }
    public LineupEntityType EntityType { get; set; }
    public int SlotPosition { get; set; }
    public bool IsCaptain { get; set; }
    public DateTime CreatedAt { get; set; }

    public Team Team { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
