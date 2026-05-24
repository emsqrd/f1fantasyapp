using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.UnitTests.Api.Mappers;

public class TeamSummaryLastRaceResponseMapperTests
{
    [Fact]
    public void ToResponseModel_MapsAllFields()
    {
        var score = new TeamRaceWeekendScore
        {
            TeamId = 1,
            RaceWeekendId = 7,
            TotalPoints = 42,
            CalculatedAt = DateTime.UtcNow,
            RaceWeekend = new RaceWeekend
            {
                SeasonId = 100,
                Round = 5,
                Name = "Monaco GP",
                CircuitId = 200,
                RaceDate = DateTime.UtcNow,
            },
        };

        var response = score.ToResponseModel();

        Assert.Equal(5, response.Round);
        Assert.Equal("Monaco GP", response.Name);
        Assert.Equal(42, response.TotalScore);
    }
}
