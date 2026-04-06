namespace F1CompanionApi.Domain.Models;

public record ConstructorWeekendScore(
    int ConstructorId,
    int? Qualifying,
    DriverSessionScore? Sprint,
    DriverSessionScore? Race
)
{
    /// <summary>
    /// Combined qualifying points from both drivers.
    /// </summary>
    public int QualifyingTotal => Qualifying ?? 0;

    /// <summary>
    /// Combined sprint points from both drivers.
    /// </summary>
    public int SprintTotal => Sprint?.Total ?? 0;

    /// <summary>
    /// Combined race points from both drivers.
    /// </summary>
    public int RaceTotal => Race?.Total ?? 0;

    /// <summary>
    /// Full weekend points for this constructor entry.
    /// </summary>
    public int Total => QualifyingTotal + SprintTotal + RaceTotal;
}
