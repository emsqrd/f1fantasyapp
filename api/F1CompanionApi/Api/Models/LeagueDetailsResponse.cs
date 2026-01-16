namespace F1CompanionApi.Api.Models;

public class LeagueDetailsResponse
{
    public required int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public int MaxTeams { get; set; }
    public bool IsPrivate { get; set; }
    public required string OwnerName { get; set; }
    public ICollection<TeamResponse> Teams { get; set; } = [];
}
