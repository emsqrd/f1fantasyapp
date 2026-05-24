using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class MyLeagueStandingResponseMapper
{
    public static MyLeagueStandingResponse ToResponseModel(
        this LeagueTeam membership,
        int totalTeams,
        TeamLeagueStanding? latestStanding
    )
    {
        return new MyLeagueStandingResponse
        {
            LeagueId = membership.LeagueId,
            LeagueName = membership.League.Name,
            TotalTeams = totalTeams,
            Position = latestStanding?.Position,
            TotalPoints = latestStanding?.TotalPoints,
        };
    }
}
