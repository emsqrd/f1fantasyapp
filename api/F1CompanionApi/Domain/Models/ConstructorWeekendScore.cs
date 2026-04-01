namespace F1CompanionApi.Domain.Models;

public record ConstructorWeekendScore(
    int ConstructorId,
    DriverWeekendScore Driver1,
    DriverWeekendScore Driver2
)
{
    public int QualifyingTotal =>
        (Driver1.Qualifying?.PositionPoints ?? 0) + (Driver2.Qualifying?.PositionPoints ?? 0);

    public int SprintTotal => (Driver1.Sprint?.Total ?? 0) + (Driver2.Sprint?.Total ?? 0);

    public int RaceTotal => (Driver1.Race?.Total ?? 0) + (Driver2.Race?.Total ?? 0);

    public int Total => QualifyingTotal + SprintTotal + RaceTotal;
}
