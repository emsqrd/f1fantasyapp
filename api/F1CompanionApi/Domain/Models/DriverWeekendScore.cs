using F1CompanionApi.Domain.Constants;

namespace F1CompanionApi.Domain.Models;

public record DriverWeekendScore(
    int DriverId,
    DriverQualifyingScore? Qualifying,
    DriverSessionScore? Sprint,
    DriverSessionScore? Race,
    bool IsCaptain
)
{
    private int Multiplier => IsCaptain ? ScoringConstants.CaptainMultiplier : 1;

    public int AdjustedQualifying => (Qualifying?.PositionPoints ?? 0) * Multiplier;
    public int AdjustedSprint => (Sprint?.Total ?? 0) * Multiplier;
    public int AdjustedRace => (Race?.Total ?? 0) * Multiplier;

    public int RawTotal =>
        (Qualifying?.PositionPoints ?? 0) + (Sprint?.Total ?? 0) + (Race?.Total ?? 0);

    public int AdjustedTotal => RawTotal * Multiplier;
}
