using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Extensions;

namespace F1CompanionApi.Api.Mappers;

public static class LeagueResponseMapper
{
    public static LeagueResponse ToResponseModel(this League league)
    {
        return new LeagueResponse
        {
            Id = league.Id,
            Name = league.Name,
            Description = league.Description,
            OwnerId = league.OwnerId,
            OwnerName = league.Owner.GetFullName(),
            TeamCount = league.LeagueTeams.Count,
            MaxTeams = league.MaxTeams,
            IsPrivate = league.IsPrivate,
        };
    }

    public static LeagueDetailsResponse ToDetailsResponseModel(this League league)
    {
        return new LeagueDetailsResponse
        {
            Id = league.Id,
            Name = league.Name,
            Description = league.Description,
            OwnerId = league.OwnerId,
            OwnerName = league.Owner.GetFullName(),
            TeamCount = league.LeagueTeams.Count,
            MaxTeams = league.MaxTeams,
            IsPrivate = league.IsPrivate,
            Teams = league.LeagueTeams
                        .Select(lt => lt.Team.ToResponseModel())
                        .ToList(),
        };
    }
}
