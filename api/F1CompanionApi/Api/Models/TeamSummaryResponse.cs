namespace F1CompanionApi.Api.Models;

public class TeamSummaryResponse
{
    public int? SeasonTotalPoints { get; set; }
    public TeamSummaryLastRaceResponse? LastRace { get; set; }
}
