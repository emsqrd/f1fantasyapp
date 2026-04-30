using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Models;

public class DriverQualifyingResultResponse
{
    public required int Id { get; set; }
    public required int DriverId { get; set; }
    public required int RaceWeekendId { get; set; }
    public int? Position { get; set; }
    public required RacingStatus Status { get; set; }
}
