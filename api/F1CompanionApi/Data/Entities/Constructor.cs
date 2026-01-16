using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a Formula 1 constructor (racing team) with name and country information.
/// </summary>
[Index(nameof(Name), IsUnique = true)]
public class Constructor : BaseEntity
{
    public required string Name { get; set; }
    public string? FullName { get; set; }
    public required string CountryAbbreviation { get; set; }
    public bool IsActive { get; set; }
}
