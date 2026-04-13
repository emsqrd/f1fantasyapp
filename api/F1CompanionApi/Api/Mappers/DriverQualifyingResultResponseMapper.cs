using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class DriverQualifyingResultResponseMapper
{
    public static IEnumerable<DriverQualifyingResultResponse> ToResponseModel(
        this IEnumerable<DriverQualifyingResult> results
    )
    {
        return results.Select(r => r.ToResponseModel());
    }

    public static DriverQualifyingResultResponse ToResponseModel(this DriverQualifyingResult result)
    {
        return new DriverQualifyingResultResponse
        {
            Id = result.Id,
            DriverId = result.DriverId,
            RaceId = result.RaceWeekendId,
            Position = result.Position,
        };
    }
}
