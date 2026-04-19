using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.Api.Endpoints;

internal static class RaceWeekendEndpointHelpers
{
    public static async Task<int?> ResolveRaceWeekendIdAsync(
        IRaceWeekendService raceWeekendService,
        ILogger logger,
        int seasonId,
        int round
    )
    {
        var id = await raceWeekendService.GetIdByRoundAsync(seasonId, round);
        if (id is null)
            logger.LogWarning(
                "Race weekend for season {SeasonId}, round {Round} not found",
                seasonId,
                round
            );
        return id;
    }
}
