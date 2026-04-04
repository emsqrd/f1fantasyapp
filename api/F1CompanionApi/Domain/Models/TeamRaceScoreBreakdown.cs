namespace F1CompanionApi.Domain.Models;

public record TeamRaceScoreBreakdown(
    int TeamId,
    int RaceId,
    List<TeamDriverScore> DriverScores,
    List<ConstructorWeekendScore> ConstructorScores
)
{
    /// <summary>
    /// Qualifying contribution from all drivers (captain-adjusted) and constructors.
    /// </summary>
    public int QualifyingTotal =>
        DriverScores.Sum(d => d.AdjustedQualifying) + ConstructorScores.Sum(c => c.QualifyingTotal);

    /// <summary>
    /// Sprint contribution from all drivers (captain-adjusted) and constructors.
    /// </summary>
    public int SprintTotal =>
        DriverScores.Sum(d => d.AdjustedSprint) + ConstructorScores.Sum(c => c.SprintTotal);

    /// <summary>
    /// Race contribution from all drivers (captain-adjusted) and constructors.
    /// </summary>
    public int RaceTotal =>
        DriverScores.Sum(d => d.AdjustedRace) + ConstructorScores.Sum(c => c.RaceTotal);

    /// <summary>
    /// Full team score for the race weekend.
    /// </summary>
    public int TotalPoints => QualifyingTotal + SprintTotal + RaceTotal;
}
