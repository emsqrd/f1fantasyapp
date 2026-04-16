using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class DriverRacingResultResponseMapper
{
    public static IEnumerable<DriverRacingResultResponse> ToResponseModel(
        this IEnumerable<DriverRacingResult> results
    )
    {
        return results.Select(r => r.ToResponseModel());
    }

    public static DriverRacingResultResponse ToResponseModel(this DriverRacingResult result)
    {
        return new DriverRacingResultResponse
        {
            Id = result.Id,
            DriverId = result.DriverId,
            RaceWeekendId = result.RaceWeekendId,
            SessionType = result.SessionType,
            GridPosition = result.GridPosition,
            FinishPosition = result.FinishPosition,
            Overtakes = result.Overtakes,
            FastestLap = result.FastestLap,
            Status = result.Status,
        };
    }
}
