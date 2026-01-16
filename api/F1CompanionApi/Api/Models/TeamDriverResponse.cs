namespace F1CompanionApi.Api.Models;

public class TeamDriverResponse
{
    public int SlotPosition { get; set; }
    public int Id { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Abbreviation { get; set; }
    public required string CountryAbbreviation { get; set; }
}
