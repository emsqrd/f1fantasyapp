namespace F1CompanionApi.Api.Models;

public class TeamLeagueStandingResponse
{
    public required int TeamId { get; set; }
    public required string TeamName { get; set; }
    public required int OwnerId { get; set; }
    public required string OwnerName { get; set; }
    public required int Position { get; set; }
    public required int TotalPoints { get; set; }
    public int? PositionChange { get; set; }
}
