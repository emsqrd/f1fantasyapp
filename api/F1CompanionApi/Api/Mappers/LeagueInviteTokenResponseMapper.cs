using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Extensions;

namespace F1CompanionApi.Api.Mappers;

public static class LeagueInviteTokenResponseMapper
{
    public static LeagueInviteTokenResponse ToResponseModel(this LeagueInvite leagueInvite)
    {
        return new LeagueInviteTokenResponse
        {
            Id = leagueInvite.Id,
            LeagueId = leagueInvite.LeagueId,
            Token = leagueInvite.Token,
            CreatedAt = leagueInvite.CreatedAt,
            CreatedByName = leagueInvite.CreatedByUser.GetFullName(),
        };
    }
}
