using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class SeasonEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapSeasonEndpoints(this IEndpointRouteBuilder app)
    {
        var seasonsGroup = app.MapGroup("/seasons").RequireAuthorization().WithOpenApi();

        seasonsGroup
            .MapGet("/", GetSeasonsAsync)
            .WithName("GetSeasons")
            .WithDescription("Get all seasons");

        seasonsGroup
            .MapGet("/current", GetCurrentSeasonAsync)
            .WithName("GetCurrentSeason")
            .WithDescription("Get the current active season");

        seasonsGroup
            .MapGet("/{id}", GetSeasonByIdAsync)
            .WithName("GetSeasonById")
            .WithDescription("Get a season by ID");

        return app;
    }

    private static async Task<IResult> GetSeasonsAsync(
        ISeasonService seasonService,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching all seasons");

        var seasons = await seasonService.GetSeasonsAsync();

        return Results.Ok(seasons);
    }

    private static async Task<IResult> GetCurrentSeasonAsync(
        ISeasonService seasonService,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching current season");

        var season = await seasonService.GetCurrentSeasonAsync();

        if (season is null)
        {
            logger.LogWarning("No active season found");
            return Results.Problem(
                detail: "No active season found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(season.ToResponseModel(season.Id));
    }

    private static async Task<IResult> GetSeasonByIdAsync(
        ISeasonService seasonService,
        int id,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching season {SeasonId}", id);

        var season = await seasonService.GetSeasonByIdAsync(id);

        if (season is null)
        {
            logger.LogWarning("Season {SeasonId} not found", id);
            return Results.Problem(
                detail: "Season not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(season);
    }
}
