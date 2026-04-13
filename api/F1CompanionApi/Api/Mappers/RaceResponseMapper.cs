using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class RaceResponseMapper
{
    public static IEnumerable<RaceResponse> ToResponseModel(
        this IEnumerable<RaceWeekend> raceWeekends,
        int? currentRaceId
    )
    {
        return raceWeekends.Select(r => r.ToResponseModel(currentRaceId));
    }

    public static RaceResponse ToResponseModel(
        this RaceWeekend raceWeekend,
        int? currentRaceId = null
    )
    {
        return new RaceResponse
        {
            Id = raceWeekend.Id,
            SeasonId = raceWeekend.SeasonId,
            Round = raceWeekend.Round,
            Name = raceWeekend.Name,
            Circuit = raceWeekend.Circuit.ToResponseModel(),
            RaceDate = raceWeekend.RaceDate,
            LockDeadline = raceWeekend.LockDeadline,
            IsCurrent = raceWeekend.Id == currentRaceId,
            HasSprint = raceWeekend.HasSprint,
        };
    }
}
