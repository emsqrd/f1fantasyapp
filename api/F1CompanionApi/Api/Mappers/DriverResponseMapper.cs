using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class DriverResponseMapper
{
    public static DriverResponse ToResponseModel(this Driver driver)
    {
        return new DriverResponse
        {
            Id = driver.Id,
            Type = "driver",
            FirstName = driver.FirstName,
            LastName = driver.LastName,
            Abbreviation = driver.Abbreviation,
            CountryAbbreviation = driver.CountryAbbreviation
        };
    }

    public static IEnumerable<DriverResponse> ToResponseModel(this IEnumerable<Driver> drivers)
    {
        return drivers.Select(driver => driver.ToResponseModel());
    }
}
