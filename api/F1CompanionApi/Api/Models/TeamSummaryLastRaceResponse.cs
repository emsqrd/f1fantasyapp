namespace F1CompanionApi.Api.Models;

public class TeamSummaryLastRaceResponse
{
    public required int Round { get; set; }
    public required string Name { get; set; }
    public required int TotalScore { get; set; }
}
