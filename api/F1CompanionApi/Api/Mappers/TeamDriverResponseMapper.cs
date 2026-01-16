using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class TeamDriverResponseMapper
{
    public static TeamDriverResponse ToResponseModel(this TeamDriver teamDriver)
    {
        return new TeamDriverResponse
        {
            SlotPosition = teamDriver.SlotPosition,
            Id = teamDriver.Driver.Id,
            FirstName = teamDriver.Driver.FirstName,
            LastName = teamDriver.Driver.LastName,
            Abbreviation = teamDriver.Driver.Abbreviation,
            CountryAbbreviation = teamDriver.Driver.CountryAbbreviation
        };
    }
}
