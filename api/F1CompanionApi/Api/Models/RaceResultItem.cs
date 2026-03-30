using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Models;

public class RaceResultItem
{
    public required int DriverId { get; set; }
    public required int GridPosition { get; set; }
    public int? FinishPosition { get; set; }
    public required int Overtakes { get; set; }
    public required bool FastestLap { get; set; }
    public required RaceStatus Status { get; set; }
}
