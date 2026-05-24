using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class TeamSummaryLastRaceResponseMapper
{
    public static TeamSummaryLastRaceResponse ToResponseModel(this TeamRaceWeekendScore score)
    {
        return new TeamSummaryLastRaceResponse
        {
            Round = score.RaceWeekend.Round,
            Name = score.RaceWeekend.Name,
            TotalScore = score.TotalPoints,
        };
    }
}
