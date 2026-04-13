using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(TeamId), nameof(RaceWeekendId), IsUnique = true)]
public class TeamRaceScore : BaseEntity
{
    public required int TeamId { get; set; }
    public required int RaceWeekendId { get; set; }
    public required int TotalPoints { get; set; }
    public required DateTime CalculatedAt { get; set; }

    public Team Team { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
