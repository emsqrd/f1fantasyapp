using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(TeamId), nameof(SeasonRaceId), IsUnique = true)]
public class TeamRaceScore : BaseEntity
{
    public required int TeamId { get; set; }
    public required int SeasonRaceId { get; set; }
    public required int TotalPoints { get; set; }
    public required DateTime CalculatedAt { get; set; }

    public Team Team { get; set; } = null!;
    public SeasonRace SeasonRace { get; set; } = null!;
}
