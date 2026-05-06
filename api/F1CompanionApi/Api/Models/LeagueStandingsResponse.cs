using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Models;

public class LeagueStandingsResponse
{
    public required int LeagueId { get; set; }
    public int? CurrentRound { get; set; }
    public required int TotalRounds { get; set; }
    public string? AfterRaceWeekendName { get; set; }
    public SessionType? AfterSessionType { get; set; }
    public required List<TeamLeagueStandingResponse> Standings { get; set; } = [];
}
