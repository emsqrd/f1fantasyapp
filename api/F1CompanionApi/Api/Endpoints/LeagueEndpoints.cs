using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class LeagueEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapLeagueEndpoints(this IEndpointRouteBuilder app)
    {
        var leaguesGroup = app.MapGroup("/leagues")
            .WithOpenApi();

        leaguesGroup.MapPost("/", CreateLeagueAsync)
            .RequireAuthorization()
            .WithName("CreateLeague")
            .WithDescription("Create a new league");

        leaguesGroup.MapGet("/", GetLeaguesAsync)
            .RequireAuthorization()
            .WithName("GetLeagues")
            .WithDescription("Get all leagues");

        leaguesGroup.MapGet("/available", GetAvailableLeaguesAsync)
            .RequireAuthorization()
            .WithName("GetAvailableLeagues")
            .WithDescription("Get all available leagues");

        leaguesGroup.MapGet("/{id}", GetLeagueByIdAsync)
            .RequireAuthorization()
            .WithName("GetLeagueById")
            .WithDescription("Get a league by ID");

        leaguesGroup.MapPost("/{id}/join", JoinLeagueAsync)
            .RequireAuthorization()
            .WithName("JoinLeague")
            .WithDescription("Join a league");

        leaguesGroup.MapPost("/{id}/invite", GetOrCreateInviteAsync)
            .RequireAuthorization()
            .WithName("GetOrCreateInvite")
            .WithDescription("Get or Create a League Invite");

        leaguesGroup.MapGet("/join/{token}/preview", ValidateAndPreviewLeagueInviteAsync)
            .WithName("ValidateAndPreviewLeagueInvite")
            .WithDescription("Validate and Preview a League Invite");

        leaguesGroup.MapPost("/join/{token}", JoinLeagueViaLeagueInviteAsync)
            .RequireAuthorization()
            .WithName("JoinLeagueViaLeagueInvite")
            .WithDescription("Join a League with a League Invite");

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

        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();
        var leagueResponse = await leagueService.CreateLeagueAsync(createLeagueRequest, user.Id);

        logger.LogInformation("Successfully created league {LeagueId} for user {UserId}",
            leagueResponse.Id, user.Id);

        return Results.Created($"/leagues/{leagueResponse.Id}", leagueResponse);
    }

    private static async Task<IResult> GetLeaguesAsync(
        ILeagueService leagueService,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching all leagues");
        var leagues = await leagueService.GetLeaguesAsync();

        return Results.Ok(leagues);
    }

    private static async Task<IResult> GetAvailableLeaguesAsync(
        ILeagueService leagueService,
        IUserProfileService userProfileService,
        [FromQuery] string? searchTerm,
        [FromServices] ILogger logger)
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogDebug("Fetching available leagues for user {UserId}", user.Id);
        var leagues = await leagueService.GetAvailableLeaguesAsync(user.Id, searchTerm);

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

    private static async Task<IResult> JoinLeagueAsync(
        ILeagueService leagueService,
        IUserProfileService userProfileService,
        int id,
        [FromServices] ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation("User {UserId} attempting to join league {LeagueId}", user.Id, id);

        var league = await leagueService.JoinLeagueAsync(id, user.Id);

        logger.LogInformation("User {UserId} successfully joined league {LeagueId}", user.Id, id);

        return Results.Ok(league);
    }

    private static async Task<IResult> GetOrCreateInviteAsync(
        ILeagueInviteService leagueInviteService,
        IUserProfileService userProfileService,
        int id,
        [FromServices] ILogger logger
    )
    {
        var requester = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation("Requestor {RequestorId} is requesting to join league {LeagueId}", requester.Id, id);

        var leagueInvite = await leagueInviteService.GetOrCreateLeagueInviteAsync(id, requester.Id);

        return Results.Ok(leagueInvite);
    }

    private static async Task<IResult> ValidateAndPreviewLeagueInviteAsync(
        ILeagueInviteService leagueInviteService,
        IUserProfileService userProfileService,
        string token,
        [FromServices] ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation("User {UserId} is requesting to join a league via invite", user.Id);

        var leagueInviteTokenPreview = await leagueInviteService.ValidateAndPreviewLeagueInviteAsync(token);

        return Results.Ok(leagueInviteTokenPreview);
    }

    private static async Task<IResult> JoinLeagueViaLeagueInviteAsync(
        ILeagueInviteService leagueInviteService,
        IUserProfileService userProfileService,
        string token,
        [FromServices] ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation("User {UserId} attempting to join a league via invite", user.Id);

        var joinedLeague = await leagueInviteService.JoinLeagueViaLeagueInviteAsync(token, user.Id);

        logger.LogInformation("UserId {UserId} successfully joined league {LeagueId}", user.Id, joinedLeague.Id);

        return Results.Ok(joinedLeague);
    }
}
