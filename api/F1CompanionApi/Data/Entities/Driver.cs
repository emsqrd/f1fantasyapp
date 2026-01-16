using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a Formula 1 driver with personal information and active status.
/// </summary>
[Index(nameof(Abbreviation), IsUnique = true)]
public class Driver : BaseEntity
{
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public required string Abbreviation { get; set; }
    public required string CountryAbbreviation { get; set; }
    public bool IsActive { get; set; }
}