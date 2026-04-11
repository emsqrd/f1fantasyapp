using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data.Entities;

[Index(nameof(DriverId), nameof(SeasonRaceId), IsUnique = true)]
public class DriverQualifyingResult : BaseEntity
{
    public required int DriverId { get; set; }
    public required int SeasonRaceId { get; set; }
    public required int Position { get; set; }

    public Driver Driver { get; set; } = null!;
    public SeasonRace SeasonRace { get; set; } = null!;
}
