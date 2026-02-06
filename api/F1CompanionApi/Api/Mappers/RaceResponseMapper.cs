using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class RaceResponseMapper
{
    public static IEnumerable<RaceResponse> ToResponseModel(
        this IEnumerable<Race> races,
        int? currentRaceId)
    {
        return races.Select(r => r.ToResponseModel(currentRaceId));
    }

    public static RaceResponse ToResponseModel(this Race race, int? currentRaceId = null)
    {
        return new RaceResponse
        {
            Id = race.Id,
            SeasonId = race.SeasonId,
            Round = race.Round,
            Name = race.Name,
            Location = race.Location,
            Circuit = race.Circuit,
            Country = race.Country,
            RaceDate = race.RaceDate,
            LockDeadline = race.LockDeadline,
            IsCurrent = race.Id == currentRaceId,
        };
    }
}
