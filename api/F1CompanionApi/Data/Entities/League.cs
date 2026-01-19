namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a fantasy F1 league with configurable privacy settings and team limits.
/// </summary>
public class League : UserOwnedEntity
{
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int MaxTeams { get; set; } = 15;
    public bool IsPrivate { get; set; }
    public required int OwnerId { get; set; }

    public UserProfile Owner { get; set; } = null!;
    public ICollection<LeagueTeam> LeagueTeams { get; set; } = new List<LeagueTeam>();
}
