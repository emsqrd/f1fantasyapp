using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class RaceWeekendEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapRaceWeekendEndpoints(this IEndpointRouteBuilder app)
    {
        var raceWeekendsGroup = app.MapGroup("/seasons/{seasonId}/race-weekends")
            .RequireAuthorization()
            .WithOpenApi();

        raceWeekendsGroup
            .MapGet("/", GetRaceWeekendsBySeasonAsync)
            .WithName("GetRaceWeekendsBySeason")
            .WithDescription("Get all race weekends for a season");

        raceWeekendsGroup
            .MapGet("/{round}", GetRaceWeekendByRoundAsync)
            .WithName("GetRaceWeekendByRound")
            .WithDescription("Get a race weekend by round number");

        return app;
    }

    private static async Task<IResult> GetRaceWeekendsBySeasonAsync(
        IRaceWeekendService raceWeekendService,
        int seasonId,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching race weekends for season {SeasonId}", seasonId);

        var raceWeekends = await raceWeekendService.GetRaceWeekendsBySeasonAsync(seasonId);

        return Results.Ok(raceWeekends);
    }

    private static async Task<IResult> GetRaceWeekendByRoundAsync(
        IRaceWeekendService raceWeekendService,
        int seasonId,
        int round,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug(
            "Fetching race weekend for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekend = await raceWeekendService.GetRaceWeekendByRoundAsync(seasonId, round);

        if (raceWeekend is null)
        {
            logger.LogWarning(
                "Race weekend for season {SeasonId}, round {Round} not found",
                seasonId,
                round
            );
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(raceWeekend);
    }
}
