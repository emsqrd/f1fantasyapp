using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(DriverId), nameof(RaceWeekendId), nameof(SessionType), IsUnique = true)]
public class DriverRacingResult : BaseEntity
{
    public required int DriverId { get; set; }
    public required int RaceWeekendId { get; set; }
    public required SessionType SessionType { get; set; }
    public required int GridPosition { get; set; }
    public int? FinishPosition { get; set; }
    public required int Overtakes { get; set; }
    public required bool FastestLap { get; set; }
    public required RacingStatus Status { get; set; }

    public Driver Driver { get; set; } = null!;
    public RaceWeekend RaceWeekend { get; set; } = null!;
}
