namespace F1CompanionApi.Domain.Models;

public record DriverWeekendScore(
    int DriverId,
    int? Qualifying,
    DriverSessionScore? Sprint,
    DriverSessionScore? Race
)
{
    /// <summary>
    /// Combined points across every session the driver contested this weekend.
    /// </summary>
    public int TotalPoints => (Qualifying ?? 0) + (Sprint?.Total ?? 0) + (Race?.Total ?? 0);
}
