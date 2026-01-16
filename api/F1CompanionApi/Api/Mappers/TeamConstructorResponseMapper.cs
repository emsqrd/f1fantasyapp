using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class TeamConstructorResponseMapper
{
    public static TeamConstructorResponse ToResponseModel(this TeamConstructor teamConstructor)
    {
        return new TeamConstructorResponse
        {
            SlotPosition = teamConstructor.SlotPosition,
            Id = teamConstructor.Constructor.Id,
            Name = teamConstructor.Constructor.Name,
            FullName = teamConstructor.Constructor.FullName,
            CountryAbbreviation = teamConstructor.Constructor.CountryAbbreviation,
            IsActive = teamConstructor.Constructor.IsActive
        };
    }
}
