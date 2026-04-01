namespace F1CompanionApi.Domain.Models;

public record TeamRaceScoreBreakdown(
    int TeamId,
    int RaceId,
    List<DriverWeekendScore> DriverScores,
    List<ConstructorWeekendScore> ConstructorScores
)
{
    public int QualifyingTotal =>
        DriverScores.Sum(d => d.AdjustedQualifying) + ConstructorScores.Sum(c => c.QualifyingTotal);

    public int SprintTotal =>
        DriverScores.Sum(d => d.AdjustedSprint) + ConstructorScores.Sum(c => c.SprintTotal);

    public int RaceTotal =>
        DriverScores.Sum(d => d.AdjustedRace) + ConstructorScores.Sum(c => c.RaceTotal);

    public int TotalPoints => QualifyingTotal + SprintTotal + RaceTotal;
}
