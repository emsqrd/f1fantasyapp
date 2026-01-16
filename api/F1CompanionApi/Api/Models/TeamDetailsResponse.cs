namespace F1CompanionApi.Api.Models;

public class TeamDetailsResponse
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string OwnerName { get; set; }
    public List<TeamDriverResponse> Drivers { get; set; } = new();
    public List<TeamConstructorResponse> Constructors { get; set; } = new();
}
