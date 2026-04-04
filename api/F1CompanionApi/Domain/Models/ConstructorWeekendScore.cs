namespace F1CompanionApi.Domain.Models;

public record ConstructorWeekendScore(
    int ConstructorId,
    DriverWeekendScore Driver1,
    DriverWeekendScore Driver2
)
{
    /// <summary>
    /// Combined qualifying points from both drivers.
    /// </summary>
    public int QualifyingTotal => (Driver1.Qualifying ?? 0) + (Driver2.Qualifying ?? 0);

    /// <summary>
    /// Combined sprint points from both drivers.
    /// </summary>
    public int SprintTotal => (Driver1.Sprint?.Total ?? 0) + (Driver2.Sprint?.Total ?? 0);

    /// <summary>
    /// Combined race points from both drivers.
    /// </summary>
    public int RaceTotal => (Driver1.Race?.Total ?? 0) + (Driver2.Race?.Total ?? 0);

    /// <summary>
    /// Full weekend points for this constructor entry.
    /// </summary>
    public int Total => QualifyingTotal + SprintTotal + RaceTotal;
}
