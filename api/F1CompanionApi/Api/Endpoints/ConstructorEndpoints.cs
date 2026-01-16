using System.ComponentModel;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class ConstructorEndpoints
{
    public static IEndpointRouteBuilder MapConstructorEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/constructors", GetConstructorsAsync)
            .RequireAuthorization()
            .WithName("GetConstructors")
            .WithOpenApi()
            .WithDescription("Retrieves a list of constructors");

        app.MapGet("/constructors/{id}", GetConstructorByIdAsync)
            .RequireAuthorization()
            .WithName("GetConstructorById")
            .WithOpenApi()
            .WithDescription("Retrieves a specific constructor by Id");

        return app;
    }

    private static async Task<IResult> GetConstructorsAsync(
        IConstructorService constructorService,
        [FromQuery][Description("Filter to active constructors only")] bool? activeOnly,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching all constructors");

        var constructors = await constructorService.GetConstructorsAsync(activeOnly);

        return Results.Ok(constructors);
    }

    private static async Task<IResult> GetConstructorByIdAsync(
        IConstructorService constructorService,
        int id,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching Constructor {ConstructorId}", id);

        var constructor = await constructorService.GetConstructorByIdAsync(id);

        if (constructor is null)
        {
            logger.LogWarning("Constructor {ConstructorId} not found", id);

            return Results.Problem(
                detail: "Constructor not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(constructor);
    }

}
