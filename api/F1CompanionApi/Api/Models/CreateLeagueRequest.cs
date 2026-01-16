namespace F1CompanionApi.Api.Models;

public class CreateLeagueRequest
{
    public required string Name { get; set; }
    public string? Description { get; set; }
}
