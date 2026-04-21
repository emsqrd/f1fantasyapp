using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.Api.Endpoints;

public static class RaceWeekendScoringEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapRaceWeekendScoringEndpoints(
        this IEndpointRouteBuilder app
    )
    {
        var group = app.MapGroup("/seasons/{seasonId}/race-weekends/{round}")
            .RequireAuthorization();

        group
            .MapPost("/score", ScoreRaceWeekendAsync)
            .RequireAuthorization("ApiKeyOnly")
            .WithName("ScoreRaceWeekend")
            .WithDescription(
                "Score a race weekend: compute driver, constructor, and team scores. "
                    + "Called after each session's results have been submitted."
            );

        return app;
    }

    private static async Task<IResult> ScoreRaceWeekendAsync(
        IRaceWeekendService raceWeekendService,
        IScoringService scoringService,
        int seasonId,
        int round
    )
    {
        var raceWeekendId = await raceWeekendService.GetIdByRoundAsync(seasonId, round);
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        await scoringService.ScoreRaceWeekendAsync(raceWeekendId.Value);
        return Results.NoContent();
    }
}
