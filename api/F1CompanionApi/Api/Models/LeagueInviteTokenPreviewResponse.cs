namespace F1CompanionApi.Api.Models;

public class LeagueInviteTokenPreviewResponse
{
    public required string LeagueName { get; set; }
    public string? LeagueDescription { get; set; }
    public required string OwnerName { get; set; }
    public int CurrentTeamCount { get; set; }
    public int MaxTeams { get; set; }
    public bool IsLeagueFull { get; set; }
}
