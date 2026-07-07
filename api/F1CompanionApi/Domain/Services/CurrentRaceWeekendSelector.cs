using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Domain.Services;

/// <summary>
/// Pure selection logic for the current race weekend: the earliest unscored round.
/// A round that has run but isn't scored yet stays current until scoring lands.
/// </summary>
public static class CurrentRaceWeekendSelector
{
    public static RaceWeekend? GetCurrentRaceWeekend(IEnumerable<RaceWeekend> raceWeekends) =>
        raceWeekends.Where(r => r.ScoredAt == null).OrderBy(r => r.Round).FirstOrDefault();
}
