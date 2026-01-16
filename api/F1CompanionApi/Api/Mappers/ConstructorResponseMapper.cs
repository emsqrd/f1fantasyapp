using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class ConstructorResponseMapper
{
    public static ConstructorResponse ToResponseModel(this Constructor constructor)
    {
        return new ConstructorResponse
        {
            Id = constructor.Id,
            Type = "constructor",
            FullName = constructor.FullName,
            CountryAbbreviation = constructor.CountryAbbreviation,
            Name = constructor.Name,
            IsActive = constructor.IsActive
        };
    }

    public static IEnumerable<ConstructorResponse> ToResponseModel(this IEnumerable<Constructor> constructors)
    {
        return constructors.Select(constructor => constructor.ToResponseModel());
    }
}
