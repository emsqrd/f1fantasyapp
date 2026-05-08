using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Extensions;

namespace F1CompanionApi.Domain.Services;

/// <summary>
/// Builds a league's leaderboard. Teams with a current standing appear first in their
/// ranked order, each showing how many places they moved relative to their prior
/// standing. Any league members without a current standing appear at the bottom with
/// zero points.
/// </summary>
public static class LeagueStandingsBuilder
{
    /// <summary>
    /// Builds the ordered leaderboard for a league.
    /// </summary>
    /// <param name="league">The league whose standings we're building.</param>
    /// <param name="currentStandings">Each team's current standing for the round being shown.</param>
    /// <param name="priorStandings">Each team's standing from the round before.</param>
    public static List<TeamLeagueStandingResponse> Build(
        League league,
        IReadOnlyList<TeamLeagueStanding> currentStandings,
        IReadOnlyList<TeamLeagueStanding> priorStandings
    )
    {
        var priorStandingByTeamId = priorStandings.ToDictionary(p => p.TeamId);
        var leagueTeamByTeamId = league.LeagueTeams.ToDictionary(lt => lt.TeamId);

        var scoredTeamStandings = currentStandings
            .Where(ls => leagueTeamByTeamId.ContainsKey(ls.TeamId))
            .Select(ls =>
            {
                var lt = leagueTeamByTeamId[ls.TeamId];
                return new TeamLeagueStandingResponse
                {
                    TeamId = ls.TeamId,
                    TeamName = lt.Team.Name,
                    OwnerId = lt.Team.UserId,
                    OwnerName = lt.Team.Owner.GetFullName(),
                    Position = ls.Position,
                    TotalPoints = ls.TotalPoints,
                    PositionChange = priorStandingByTeamId.TryGetValue(ls.TeamId, out var prior)
                        ? prior.Position - ls.Position
                        : null,
                };
            })
            .ToList();

        var scoredTeamIds = scoredTeamStandings.Select(r => r.TeamId).ToHashSet();
        var unscoredTeamStandings = league
            .LeagueTeams.Where(lt => !scoredTeamIds.Contains(lt.TeamId))
            .OrderBy(lt => lt.TeamId)
            .Select(
                (lt, idx) =>
                    new TeamLeagueStandingResponse
                    {
                        TeamId = lt.TeamId,
                        TeamName = lt.Team.Name,
                        OwnerId = lt.Team.UserId,
                        OwnerName = lt.Team.Owner.GetFullName(),
                        Position = scoredTeamStandings.Count + idx + 1,
                        TotalPoints = 0,
                        PositionChange = null,
                    }
            )
            .ToList();

        return scoredTeamStandings.Concat(unscoredTeamStandings).ToList();
    }
}
