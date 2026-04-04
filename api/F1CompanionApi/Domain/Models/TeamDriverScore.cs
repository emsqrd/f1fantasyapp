using F1CompanionApi.Domain.Constants;

namespace F1CompanionApi.Domain.Models;

public record TeamDriverScore(DriverWeekendScore EntityScore, bool IsCaptain)
{
    /// <summary>
    /// Convenience accessor forwarded from the underlying entity score.
    /// </summary>
    public int DriverId => EntityScore.DriverId;

    /// <summary>
    /// 2x for the captain slot, 1x for everyone else.
    /// </summary>
    private int Multiplier => IsCaptain ? ScoringConstants.CaptainMultiplier : 1;

    /// <summary>
    /// Qualifying points after applying the captain multiplier.
    /// </summary>
    public int AdjustedQualifying => (EntityScore.Qualifying ?? 0) * Multiplier;

    /// <summary>
    /// Sprint points after applying the captain multiplier.
    /// </summary>
    public int AdjustedSprint => (EntityScore.Sprint?.Total ?? 0) * Multiplier;

    /// <summary>
    /// Race points after applying the captain multiplier.
    /// </summary>
    public int AdjustedRace => (EntityScore.Race?.Total ?? 0) * Multiplier;

    /// <summary>
    /// Total weekend points after applying the captain multiplier.
    /// </summary>
    public int AdjustedTotal => EntityScore.TotalPoints * Multiplier;
}
