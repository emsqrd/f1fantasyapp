using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(SeasonId), nameof(Round), IsUnique = true)]
public class SeasonRace : BaseEntity
{
    public required int SeasonId { get; set; }
    public required int Round { get; set; }
    public required string Name { get; set; }
    public required int CircuitId { get; set; }
    public required DateTime RaceDate { get; set; }
    public DateTime? LockDeadline { get; set; }
    public bool HasSprint { get; set; }

    public Season Season { get; set; } = null!;
    public Circuit Circuit { get; set; } = null!;
}
