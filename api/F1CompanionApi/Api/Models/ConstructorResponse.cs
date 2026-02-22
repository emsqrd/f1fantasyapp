namespace F1CompanionApi.Api.Models;

public class ConstructorResponse
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public required string FullName { get; set; }
    public required string Abbreviation { get; set; }
    public required string CountryAbbreviation { get; set; }
}
