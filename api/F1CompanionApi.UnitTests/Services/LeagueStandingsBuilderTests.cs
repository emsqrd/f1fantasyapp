using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.UnitTests.Services;

public class LeagueStandingsBuilderTests
{
    private static readonly DateTime CalculatedAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Build_LeagueWithNoTeams_ReturnsEmptyList()
    {
        var league = LeagueWith();

        var result = LeagueStandingsBuilder.Build(league, currentStandings: [], priorStandings: []);

        Assert.Empty(result);
    }

    [Fact]
    public void Build_NoCurrentStandings_AllTeamsZeroFilledByTeamIdAsc()
    {
        var league = LeagueWith(Member(teamId: 2, "Bravo"), Member(teamId: 1, "Alpha"));

        var result = LeagueStandingsBuilder.Build(league, currentStandings: [], priorStandings: []);

        Assert.Collection(
            result,
            row =>
            {
                Assert.Equal(1, row.TeamId);
                Assert.Equal(1, row.Position);
                Assert.Equal(0, row.TotalPoints);
                Assert.Null(row.PositionChange);
            },
            row =>
            {
                Assert.Equal(2, row.TeamId);
                Assert.Equal(2, row.Position);
                Assert.Equal(0, row.TotalPoints);
                Assert.Null(row.PositionChange);
            }
        );
    }

    [Fact]
    public void Build_LateJoinTeamHasNullPositionChange()
    {
        // team 2 leads round 2 but had no row in round 1 → null change.
        // team 1 went from 1 → 2 → -1.
        var league = LeagueWith(Member(teamId: 1, "Alpha"), Member(teamId: 2, "Bravo"));
        var current = new[]
        {
            Standing(teamId: 2, position: 1, totalPoints: 80),
            Standing(teamId: 1, position: 2, totalPoints: 50),
        };
        var prior = new[] { Standing(teamId: 1, position: 1, totalPoints: 30) };

        var result = LeagueStandingsBuilder.Build(league, current, prior);

        Assert.Collection(
            result,
            row =>
            {
                Assert.Equal(2, row.TeamId);
                Assert.Equal(1, row.Position);
                Assert.Null(row.PositionChange);
            },
            row =>
            {
                Assert.Equal(1, row.TeamId);
                Assert.Equal(2, row.Position);
                Assert.Equal(-1, row.PositionChange);
            }
        );
    }

    [Fact]
    public void Build_TeamsWithoutCurrentRow_AppendedAtBottomInTeamIdAsc()
    {
        var league = LeagueWith(
            Member(teamId: 1, "Alpha"),
            Member(teamId: 2, "Bravo"),
            Member(teamId: 4, "Delta"),
            Member(teamId: 3, "Charlie")
        );
        var current = new[]
        {
            Standing(teamId: 1, position: 1, totalPoints: 50),
            Standing(teamId: 2, position: 2, totalPoints: 30),
        };

        var result = LeagueStandingsBuilder.Build(league, current, priorStandings: []);

        Assert.Equal(4, result.Count);
        Assert.Equal((1, 1, 50), (result[0].TeamId, result[0].Position, result[0].TotalPoints));
        Assert.Equal((2, 2, 30), (result[1].TeamId, result[1].Position, result[1].TotalPoints));
        Assert.Equal((3, 3, 0), (result[2].TeamId, result[2].Position, result[2].TotalPoints));
        Assert.Null(result[2].PositionChange);
        Assert.Equal((4, 4, 0), (result[3].TeamId, result[3].Position, result[3].TotalPoints));
        Assert.Null(result[3].PositionChange);
    }

    private static League LeagueWith(params LeagueTeam[] members) =>
        new()
        {
            Name = "Test League",
            OwnerId = 0,
            LeagueTeams = members,
        };

    private static LeagueTeam Member(int teamId, string teamName) =>
        new()
        {
            TeamId = teamId,
            Team = new Team
            {
                Name = teamName,
                UserId = teamId * 100,
                Owner = new UserProfile
                {
                    Id = teamId * 100,
                    AccountId = $"acct-{teamId}",
                    Email = $"{teamName.ToLowerInvariant()}@test.local",
                    FirstName = teamName,
                    LastName = "Owner",
                },
            },
        };

    private static TeamLeagueStanding Standing(int teamId, int position, int totalPoints) =>
        new()
        {
            LeagueId = 10,
            TeamId = teamId,
            RaceWeekendId = 1,
            Position = position,
            TotalPoints = totalPoints,
            CalculatedAt = CalculatedAt,
            CreatedAt = CalculatedAt,
        };
}
