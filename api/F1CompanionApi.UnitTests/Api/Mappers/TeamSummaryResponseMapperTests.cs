using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.UnitTests.Api.Mappers;

public class TeamSummaryResponseMapperTests
{
    [Fact]
    public void ToResponseModel_NullLatest_ReturnsNullFields()
    {
        var response = Array
            .Empty<TeamRaceWeekendScore>()
            .ToResponseModel(latest: null, teamName: "Grid Gladiators");

        Assert.Equal("Grid Gladiators", response.TeamName);
        Assert.Null(response.SeasonTotalPoints);
        Assert.Null(response.LastRace);
    }

    [Fact]
    public void ToResponseModel_WithLatest_SumsAndMapsLastRace()
    {
        var scores = new[]
        {
            Score(round: 1, points: 25, name: "Round One"),
            Score(round: 2, points: 40, name: "Round Two"),
            Score(round: 3, points: 18, name: "Round Three"),
        };
        var latest = scores[2];

        var response = scores.ToResponseModel(latest, teamName: "Grid Gladiators");

        Assert.Equal("Grid Gladiators", response.TeamName);
        Assert.Equal(25 + 40 + 18, response.SeasonTotalPoints);
        Assert.NotNull(response.LastRace);
        Assert.Equal(3, response.LastRace!.Round);
        Assert.Equal("Round Three", response.LastRace.Name);
        Assert.Equal(18, response.LastRace.TotalScore);
    }

    private static TeamRaceWeekendScore Score(int round, int points, string name) =>
        new()
        {
            TeamId = 1,
            RaceWeekendId = round,
            TotalPoints = points,
            CalculatedAt = DateTime.UtcNow,
            RaceWeekend = new RaceWeekend
            {
                SeasonId = 100,
                Round = round,
                Name = name,
                CircuitId = 200,
                RaceDate = DateTime.UtcNow,
            },
        };
}
