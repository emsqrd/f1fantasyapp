namespace F1CompanionApi.Api.Models;

public class LeagueStandingsResponse
{
    public required int LeagueId { get; set; }
    public int? LastScoredRound { get; set; }
    public string? LastScoredRaceWeekendName { get; set; }
    public required List<TeamLeagueStandingResponse> Standings { get; set; } = [];
}
