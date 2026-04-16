using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(ConstructorId), nameof(RaceWeekendId), IsUnique = true)]
public class ConstructorRaceWeekendScore : BaseEntity
{
    public required int ConstructorId { get; set; }
    public required int RaceWeekendId { get; set; }

    public int? QualifyingPositionPoints { get; set; }

    public int? SprintPositionPoints { get; set; }
    public int? SprintPositionChangePoints { get; set; }
    public int? SprintOvertakePoints { get; set; }
    public int? SprintFastestLapPoints { get; set; }
    public int? SprintPenaltyPoints { get; set; }
    public int? SprintTotal { get; set; }

    public int? GrandPrixPositionPoints { get; set; }
    public int? GrandPrixPositionChangePoints { get; set; }
    public int? GrandPrixOvertakePoints { get; set; }
    public int? GrandPrixFastestLapPoints { get; set; }
    public int? GrandPrixPenaltyPoints { get; set; }
    public int? GrandPrixTotal { get; set; }

    public required int TotalPoints { get; set; }
    public required DateTime CalculatedAt { get; set; }

    public Constructor Constructor { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
