using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(ConstructorId), nameof(RaceId), IsUnique = true)]
public class ConstructorRaceScore : BaseEntity
{
    public required int ConstructorId { get; set; }
    public required int RaceId { get; set; }

    public int? QualifyingPositionPoints { get; set; }

    public int? SprintPositionPoints { get; set; }
    public int? SprintPositionChangePoints { get; set; }
    public int? SprintOvertakePoints { get; set; }
    public int? SprintFastestLapPoints { get; set; }
    public int? SprintPenaltyPoints { get; set; }
    public int? SprintTotal { get; set; }

    public int? RacePositionPoints { get; set; }
    public int? RacePositionChangePoints { get; set; }
    public int? RaceOvertakePoints { get; set; }
    public int? RaceFastestLapPoints { get; set; }
    public int? RacePenaltyPoints { get; set; }
    public int? RaceTotal { get; set; }

    public required int TotalPoints { get; set; }
    public required DateTime CalculatedAt { get; set; }

    public Constructor Constructor { get; set; } = null!;
    public Race Race { get; set; } = null!;
}
