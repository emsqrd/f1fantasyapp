using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(Year), IsUnique = true)]
public class Season : BaseEntity
{
    public required int Year { get; set; }
    public required DateTime StartDate { get; set; }
    public required DateTime EndDate { get; set; }

    public ICollection<Race> Races { get; set; } = [];
    public ICollection<SeasonDriver> SeasonDrivers { get; set; } = [];
    public ICollection<SeasonConstructor> SeasonConstructors { get; set; } = [];
}
