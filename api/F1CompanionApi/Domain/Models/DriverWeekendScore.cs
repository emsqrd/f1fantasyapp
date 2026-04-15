namespace F1CompanionApi.Domain.Models;

public record DriverWeekendScore(
    int DriverId,
    int? Qualifying,
    DriverSessionScore? Sprint,
    DriverSessionScore? GrandPrix
)
{
    /// <summary>
    /// Combined points across every session the driver contested this weekend.
    /// </summary>
    public int TotalPoints => (Qualifying ?? 0) + (Sprint?.Total ?? 0) + (GrandPrix?.Total ?? 0);
}
