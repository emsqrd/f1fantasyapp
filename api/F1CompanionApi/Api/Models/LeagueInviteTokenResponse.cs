namespace F1CompanionApi.Api.Models;

public class LeagueInviteTokenResponse
{
    public required int Id { get; set; }
    public required int LeagueId { get; set; }
    public required string Token { get; set; }
    public required DateTime CreatedAt { get; set; }
    public required string CreatedByName { get; set; }
}
