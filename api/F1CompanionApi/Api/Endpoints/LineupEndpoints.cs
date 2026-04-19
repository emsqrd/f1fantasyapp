using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.Api.Endpoints;

public static class LineupEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapLineupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/seasons/{seasonId}/race-weekends/{round}")
            .RequireAuthorization();

        group
            .MapPost("/advance-lineups", AdvanceLineupsAsync)
            .RequireAuthorization("ApiKeyOnly")
            .WithName("AdvanceLineups")
            .WithDescription("Carry each team's lineup forward to the next race weekend.");

        return app;
    }

    private static async Task<IResult> AdvanceLineupsAsync(
        IRaceWeekendService raceWeekendService,
        ILineupService lineupService,
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

        await lineupService.AdvanceLineupAsync(raceWeekendId.Value);
        return Results.NoContent();
    }
}
