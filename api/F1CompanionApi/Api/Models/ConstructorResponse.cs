namespace F1CompanionApi.Api.Models;

public class ConstructorResponse
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? FullName { get; set; }
    public required string CountryAbbreviation { get; set; }
    public bool IsActive { get; set; }
}
