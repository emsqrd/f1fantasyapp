using System.Diagnostics.CodeAnalysis;

using F1CompanionApi.Domain.Services;

using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class SeasonEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapSeasonEndpoints(this IEndpointRouteBuilder app)
    {
        var seasonsGroup = app.MapGroup("/seasons")
            .WithOpenApi();

        seasonsGroup.MapGet("/", GetSeasonsAsync)
            .RequireAuthorization()
            .WithName("GetSeasons")
            .WithDescription("Get all seasons");

        seasonsGroup.MapGet("/{id}", GetSeasonByIdAsync)
            .RequireAuthorization()
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
