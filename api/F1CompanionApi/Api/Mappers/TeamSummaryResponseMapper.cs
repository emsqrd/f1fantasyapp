using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class TeamSummaryResponseMapper
{
    public static TeamSummaryResponse ToResponseModel(
        this IReadOnlyList<TeamRaceWeekendScore> scoredRaces,
        TeamRaceWeekendScore? latest
    )
    {
        return new TeamSummaryResponse
        {
            SeasonTotalPoints = latest is null ? null : scoredRaces.Sum(s => s.TotalPoints),
            LastRace = latest?.ToResponseModel(),
        };
    }
}
