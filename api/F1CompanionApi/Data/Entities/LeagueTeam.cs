using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a team's membership in a league.
/// Tracks when the team joined and allows for additional membership metadata.
/// </summary>
[Index(nameof(LeagueId), nameof(TeamId), IsUnique = true)]
public class LeagueTeam : UserOwnedEntity
{
    public int LeagueId { get; set; }
    public int TeamId { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

    public League League { get; set; } = null!;
    public Team Team { get; set; } = null!;
}
