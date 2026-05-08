using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(LeagueId), nameof(TeamId), nameof(RaceWeekendId), IsUnique = true)]
[Index(nameof(LeagueId), nameof(RaceWeekendId), nameof(Position))]
public class TeamLeagueStanding : BaseEntity
{
    public required int LeagueId { get; set; }
    public required int TeamId { get; set; }
    public required int RaceWeekendId { get; set; }
    public required int Position { get; set; }
    public required int TotalPoints { get; set; }
    public required DateTime CalculatedAt { get; set; }

    public League League { get; set; } = null!;
    public Team Team { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
