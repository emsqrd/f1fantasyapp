using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.UnitTests.Services;

public class StandingsRankerTests
{
    private static readonly DateTime CalculatedAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private static TeamRaceWeekendScore Score(int teamId, int raceWeekendId, int total) =>
        new()
        {
            TeamId = teamId,
            RaceWeekendId = raceWeekendId,
            TotalPoints = total,
            CalculatedAt = CalculatedAt,
            CreatedAt = CalculatedAt,
        };

    private static TeamLeagueStanding Prior(int leagueId, int teamId, int totalPoints) =>
        new()
        {
            LeagueId = leagueId,
            TeamId = teamId,
            RaceWeekendId = 0,
            Position = 0,
            TotalPoints = totalPoints,
            CalculatedAt = CalculatedAt,
            CreatedAt = CalculatedAt,
        };

    [Fact]
    public void Rank_FirstRoundNoPriors_OrdersByTotalPointsDescendingAndAssignsPositions()
    {
        var scores = new[]
        {
            Score(teamId: 1, raceWeekendId: 1, total: 30),
            Score(teamId: 2, raceWeekendId: 1, total: 50),
            Score(teamId: 3, raceWeekendId: 1, total: 40),
        };

        var rows = StandingsRanker
            .Rank(
                leagueId: 10,
                raceWeekendId: 1,
                scoresInLeague: scores,
                priorStandingByTeamId: new Dictionary<int, TeamLeagueStanding>(),
                calculatedAt: CalculatedAt
            )
            .ToList();

        Assert.Equal(3, rows.Count);
        Assert.Equal((1, 2, 50), (rows[0].Position, rows[0].TeamId, rows[0].TotalPoints));
        Assert.Equal((2, 3, 40), (rows[1].Position, rows[1].TeamId, rows[1].TotalPoints));
        Assert.Equal((3, 1, 30), (rows[2].Position, rows[2].TeamId, rows[2].TotalPoints));
        Assert.All(rows, r => Assert.Equal(10, r.LeagueId));
        Assert.All(rows, r => Assert.Equal(1, r.RaceWeekendId));
        Assert.All(rows, r => Assert.Equal(CalculatedAt, r.CalculatedAt));
        Assert.All(rows, r => Assert.Equal(CalculatedAt, r.CreatedAt));
    }

    [Fact]
    public void Rank_WithPriorTotals_AddsPriorAndThisWeekendForCumulative()
    {
        var priors = new Dictionary<int, TeamLeagueStanding>
        {
            [1] = Prior(leagueId: 10, teamId: 1, totalPoints: 30),
            [2] = Prior(leagueId: 10, teamId: 2, totalPoints: 50),
            [3] = Prior(leagueId: 10, teamId: 3, totalPoints: 40),
        };
        var scores = new[]
        {
            Score(teamId: 1, raceWeekendId: 2, total: 60),
            Score(teamId: 2, raceWeekendId: 2, total: 10),
            Score(teamId: 3, raceWeekendId: 2, total: 20),
        };

        var rows = StandingsRanker
            .Rank(
                leagueId: 10,
                raceWeekendId: 2,
                scoresInLeague: scores,
                priorStandingByTeamId: priors,
                calculatedAt: CalculatedAt
            )
            .ToList();

        // 1: 30 + 60 = 90; 2: 50 + 10 = 60; 3: 40 + 20 = 60 (tiebreak by TeamId asc)
        Assert.Equal(3, rows.Count);
        Assert.Equal((1, 1, 90), (rows[0].Position, rows[0].TeamId, rows[0].TotalPoints));
        Assert.Equal((2, 2, 60), (rows[1].Position, rows[1].TeamId, rows[1].TotalPoints));
        Assert.Equal((3, 3, 60), (rows[2].Position, rows[2].TeamId, rows[2].TotalPoints));
    }

    [Fact]
    public void Rank_TeamWithoutPriorRow_TreatsPriorAsZero()
    {
        var priors = new Dictionary<int, TeamLeagueStanding>
        {
            [1] = Prior(leagueId: 10, teamId: 1, totalPoints: 40),
            // team 2 has no prior — late joiner
        };
        var scores = new[]
        {
            Score(teamId: 1, raceWeekendId: 2, total: 10),
            Score(teamId: 2, raceWeekendId: 2, total: 25),
        };

        var rows = StandingsRanker
            .Rank(
                leagueId: 10,
                raceWeekendId: 2,
                scoresInLeague: scores,
                priorStandingByTeamId: priors,
                calculatedAt: CalculatedAt
            )
            .ToList();

        // team 1 cumulative = 50; team 2 cumulative = 25 (no prior)
        Assert.Equal(2, rows.Count);
        Assert.Equal((1, 1, 50), (rows[0].Position, rows[0].TeamId, rows[0].TotalPoints));
        Assert.Equal((2, 2, 25), (rows[1].Position, rows[1].TeamId, rows[1].TotalPoints));
    }

    [Fact]
    public void Rank_ExactTieOnTotalPoints_OrdersByTeamIdAscending()
    {
        var scores = new[]
        {
            Score(teamId: 3, raceWeekendId: 1, total: 50),
            Score(teamId: 1, raceWeekendId: 1, total: 50),
            Score(teamId: 2, raceWeekendId: 1, total: 50),
        };

        var rows = StandingsRanker
            .Rank(
                leagueId: 10,
                raceWeekendId: 1,
                scoresInLeague: scores,
                priorStandingByTeamId: new Dictionary<int, TeamLeagueStanding>(),
                calculatedAt: CalculatedAt
            )
            .ToList();

        Assert.Equal(new[] { 1, 2, 3 }, rows.Select(r => r.TeamId).ToArray());
        Assert.Equal(new[] { 1, 2, 3 }, rows.Select(r => r.Position).ToArray());
    }
}
