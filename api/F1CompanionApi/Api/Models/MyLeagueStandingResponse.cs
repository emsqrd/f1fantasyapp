namespace F1CompanionApi.Api.Models;

public class MyLeagueStandingResponse
{
    public required int LeagueId { get; set; }
    public required string LeagueName { get; set; }
    public required int TotalTeams { get; set; }
    public int? Position { get; set; }
    public int? TotalPoints { get; set; }
}
