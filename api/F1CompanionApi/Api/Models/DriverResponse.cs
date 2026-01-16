namespace F1CompanionApi.Api.Models;

public class DriverResponse
{
    public int Id { get; set; }
    public required string Type { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Abbreviation { get; set; }
    public required string CountryAbbreviation { get; set; }
}
