namespace F1CompanionApi.Api.Models;

public class TeamConstructorResponse
{
    public int SlotPosition { get; set; }
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? FullName { get; set; }
    public required string CountryAbbreviation { get; set; }
    public bool IsActive { get; set; }
}
