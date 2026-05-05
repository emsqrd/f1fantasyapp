using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Domain.Services;

/// <summary>
/// Pure ranking logic for league standings: given one league's scoring rows for a
/// race weekend and the prior persisted standings, produces the new ordered standings.
/// </summary>
public static class StandingsRanker
{
    public static IEnumerable<LeagueStanding> Rank(
        int leagueId,
        int raceWeekendId,
        IReadOnlyList<TeamRaceWeekendScore> scoresInLeague,
        IReadOnlyDictionary<int, LeagueStanding> priorByTeam,
        DateTime calculatedAt
    )
    {
        var ranked = scoresInLeague
            .Select(s => new
            {
                s.TeamId,
                TotalPoints = (priorByTeam.GetValueOrDefault(s.TeamId)?.TotalPoints ?? 0)
                    + s.TotalPoints,
            })
            .OrderByDescending(r => r.TotalPoints)
            .ThenBy(r => r.TeamId);

        return ranked.Select(
            (r, idx) =>
                new LeagueStanding
                {
                    LeagueId = leagueId,
                    TeamId = r.TeamId,
                    RaceWeekendId = raceWeekendId,
                    Position = idx + 1,
                    TotalPoints = r.TotalPoints,
                    CalculatedAt = calculatedAt,
                    CreatedAt = calculatedAt,
                }
        );
    }
}
