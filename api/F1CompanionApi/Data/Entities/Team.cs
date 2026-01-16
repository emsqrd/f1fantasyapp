namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a fantasy F1 team with selected drivers and constructors.
/// </summary>
public class Team : UserOwnedEntity
{
    public required string Name { get; set; }
    public int UserId { get; set; } // FK

    public UserProfile Owner { get; set; } = null!;
    public ICollection<LeagueTeam> LeagueTeams { get; set; } = new List<LeagueTeam>();
    public ICollection<TeamDriver> TeamDrivers { get; set; } = new List<TeamDriver>();
    public ICollection<TeamConstructor> TeamConstructors { get; set; } = new List<TeamConstructor>();
}