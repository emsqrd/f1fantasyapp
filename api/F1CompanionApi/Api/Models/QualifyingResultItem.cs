using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Models;

public class QualifyingResultItem
{
    public required int DriverId { get; set; }
    public int? Position { get; set; }
    public required RacingStatus Status { get; set; }
}
