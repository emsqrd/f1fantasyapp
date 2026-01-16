using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Extensions;

namespace F1CompanionApi.Api.Mappers;

public static class TeamResponseMapper
{
    public static TeamResponse ToResponseModel(this Team team)
    {
        return new TeamResponse
        {
            Id = team.Id,
            Name = team.Name,
            OwnerName = team.Owner.GetFullName()
        };
    }

    public static TeamDetailsResponse ToDetailsResponseModel(this Team team)
    {
        return new TeamDetailsResponse
        {
            Id = team.Id,
            Name = team.Name,
            OwnerName = team.Owner.GetFullName(),
            Drivers = team.TeamDrivers
                .OrderBy(teamDriver => teamDriver.SlotPosition)
                .Select(teamDriver => teamDriver.ToResponseModel())
                .ToList(),
            Constructors = team.TeamConstructors
                .OrderBy(teamConstructor => teamConstructor.SlotPosition)
                .Select(teamConstructor => teamConstructor.ToResponseModel())
                .ToList()
        };
    }
}
