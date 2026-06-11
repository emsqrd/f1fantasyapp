namespace F1CompanionApi.Api.Models;

public class TeamSummaryResponse
{
    public required string TeamName { get; set; }
    public int? SeasonTotalPoints { get; set; }
    public TeamSummaryLastRaceResponse? LastRace { get; set; }
}
