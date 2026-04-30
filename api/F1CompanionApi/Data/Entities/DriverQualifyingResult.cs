using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(DriverId), nameof(RaceWeekendId), IsUnique = true)]
public class DriverQualifyingResult : BaseEntity
{
    public required int DriverId { get; set; }
    public required int RaceWeekendId { get; set; }
    public int? Position { get; set; }
    public required RacingStatus Status { get; set; }

    public Driver Driver { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
