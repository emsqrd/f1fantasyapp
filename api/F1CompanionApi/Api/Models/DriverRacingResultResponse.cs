using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Models;

public class DriverRacingResultResponse
{
    public required int Id { get; set; }
    public required int DriverId { get; set; }
    public required int RaceWeekendId { get; set; }
    public required SessionType SessionType { get; set; }
    public required int GridPosition { get; set; }
    public int? FinishPosition { get; set; }
    public required int Overtakes { get; set; }
    public required bool FastestLap { get; set; }
    public required RacingStatus Status { get; set; }
}
