using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(DriverId), nameof(RaceId), IsUnique = true)]
public class DriverQualifyingResult : BaseEntity
{
    public required int DriverId { get; set; }
    public required int RaceId { get; set; }
    public required int Position { get; set; }

    public Driver Driver { get; set; } = null!;
    public Race Race { get; set; } = null!;
}
