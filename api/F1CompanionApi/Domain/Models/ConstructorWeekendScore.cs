namespace F1CompanionApi.Domain.Models;

public record ConstructorWeekendScore(
    int ConstructorId,
    int? Qualifying,
    DriverSessionScore? Sprint,
    DriverSessionScore? GrandPrix
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
    /// Combined Grand Prix points from both drivers.
    /// </summary>
    public int GrandPrixTotal => GrandPrix?.Total ?? 0;

    /// <summary>
    /// Full weekend points for this constructor entry.
    /// </summary>
    public int Total => QualifyingTotal + SprintTotal + GrandPrixTotal;
}
