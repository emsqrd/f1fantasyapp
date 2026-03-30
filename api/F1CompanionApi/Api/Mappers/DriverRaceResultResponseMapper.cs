using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class DriverRaceResultResponseMapper
{
    public static IEnumerable<DriverRaceResultResponse> ToResponseModel(
        this IEnumerable<DriverRaceResult> results
    )
    {
        return results.Select(r => r.ToResponseModel());
    }

    public static DriverRaceResultResponse ToResponseModel(this DriverRaceResult result)
    {
        return new DriverRaceResultResponse
        {
            Id = result.Id,
            DriverId = result.DriverId,
            RaceId = result.RaceId,
            SessionType = result.SessionType,
            GridPosition = result.GridPosition,
            FinishPosition = result.FinishPosition,
            Overtakes = result.Overtakes,
            FastestLap = result.FastestLap,
            Status = result.Status,
        };
    }
}
