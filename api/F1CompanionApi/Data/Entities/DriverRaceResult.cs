using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(DriverId), nameof(RaceId), nameof(SessionType), IsUnique = true)]
public class DriverRaceResult : BaseEntity
{
    public required int DriverId { get; set; }
    public required int RaceId { get; set; }
    public required SessionType SessionType { get; set; }
    public required int GridPosition { get; set; }
    public int? FinishPosition { get; set; }
    public required int Overtakes { get; set; }
    public required bool FastestLap { get; set; }
    public required RaceStatus Status { get; set; }

    public Driver Driver { get; set; } = null!;
    public Race Race { get; set; } = null!;
}
