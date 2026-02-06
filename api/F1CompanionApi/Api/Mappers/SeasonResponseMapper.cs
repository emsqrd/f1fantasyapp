using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class SeasonResponseMapper
{
    public static IEnumerable<SeasonResponse> ToResponseModel(
        this IEnumerable<Season> seasons,
        int? currentSeasonId)
    {
        return seasons.Select(s => s.ToResponseModel(currentSeasonId));
    }

    public static SeasonResponse ToResponseModel(this Season season, int? currentSeasonId = null)
    {
        return new SeasonResponse
        {
            Id = season.Id,
            Year = season.Year,
            StartDate = season.StartDate,
            EndDate = season.EndDate,
            IsCurrent = season.Id == currentSeasonId,
        };
    }
}
