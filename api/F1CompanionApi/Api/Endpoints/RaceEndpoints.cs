using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class RaceEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapRaceEndpoints(this IEndpointRouteBuilder app)
    {
        var racesGroup = app.MapGroup("/races").RequireAuthorization().WithOpenApi();

        racesGroup.MapGet("/", GetRacesAsync).WithName("GetRaces").WithDescription("Get all races");

        racesGroup
            .MapGet("/{id}", GetRaceByIdAsync)
            .WithName("GetRaceById")
            .WithDescription("Get a race by ID");

        return app;
    }

    private static async Task<IResult> GetRacesAsync(
        IRaceService raceService,
        [FromQuery] int? seasonId,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching races for season {SeasonId}", seasonId);

        var races = await raceService.GetRacesAsync(seasonId);

        return Results.Ok(races);
    }

    private static async Task<IResult> GetRaceByIdAsync(
        IRaceService raceService,
        int id,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching race {RaceId}", id);

        var race = await raceService.GetRaceByIdAsync(id);

        if (race is null)
        {
            logger.LogWarning("Race {RaceId} not found", id);
            return Results.Problem(
                detail: "Race not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(race);
    }
}
