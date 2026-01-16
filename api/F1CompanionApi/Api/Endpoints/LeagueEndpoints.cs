using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace F1CompanionApi.Api.Endpoints;

public static class LeagueEndpoints
{
    public static IEndpointRouteBuilder MapLeagueEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/leagues", CreateLeagueAsync)
            .RequireAuthorization()
            .WithName("CreateLeague")
            .WithOpenApi()
            .WithDescription("Create a new League");

        app.MapGet("/leagues", GetLeaguesAsync)
            .RequireAuthorization()
            .WithName("GetLeagues")
            .WithOpenApi()
            .WithDescription("Gets all leagues");

        app.MapGet("/leagues/{id}", GetLeagueByIdAsync)
            .RequireAuthorization()
            .WithName("GetLeaguesById")
            .WithOpenApi()
            .WithDescription("Get League By Id");

        return app;
    }

    private static async Task<IResult> CreateLeagueAsync(
        HttpContext context,
        ISupabaseAuthService authService,
        IUserProfileService userProfileService,
        ILeagueService leagueService,
        CreateLeagueRequest createLeagueRequest,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation("Creating league {LeagueName}", createLeagueRequest.Name);

        try
        {
            var user = await userProfileService.GetRequiredCurrentUserProfileAsync();
            var leagueResponse = await leagueService.CreateLeagueAsync(createLeagueRequest, user.Id);

            logger.LogInformation("Successfully created league {LeagueId} for user {UserId}",
                leagueResponse.Id, user.Id);

            return Results.Created($"/leagues/{leagueResponse.Id}", leagueResponse);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Invalid operation when creating league {LeagueName}",
                createLeagueRequest.Name);
            return Results.Problem(
                detail: ex.Message,
                statusCode: StatusCodes.Status400BadRequest
            );
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unexpected error creating league {LeagueName}",
                createLeagueRequest.Name);
            throw;
        }
    }

    private static async Task<IResult> GetLeaguesAsync(
        ILeagueService leagueService,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching all leagues");
        var leagues = await leagueService.GetLeaguesAsync();

        return Results.Ok(leagues);
    }

    private static async Task<IResult> GetLeagueByIdAsync(
        ILeagueService leagueService,
        int id,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching league {LeagueId}", id);
        var league = await leagueService.GetLeagueByIdAsync(id);

        if (league is null)
        {
            logger.LogWarning("League {LeagueId} not found", id);
            return Results.Problem(
                detail: "League not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(league);
    }
}
