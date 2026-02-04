using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(SeasonId), nameof(Round), IsUnique = true)]
public class Race : BaseEntity
{
    public required int SeasonId { get; set; }
    public required int Round { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public required string Circuit { get; set; }
    public required string Country { get; set; }
    public required DateTime RaceDate { get; set; }
    public DateTime? LockDeadline { get; set; }

    public Season Season { get; set; } = null!;
}
