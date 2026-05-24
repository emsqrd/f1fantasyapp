using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Domain.Services;

namespace F1CompanionApi.Api.Endpoints;

public static class MeEndpoints
{
    public record RegisterUserRequest(string? DisplayName);

    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapMeEndpoints(this IEndpointRouteBuilder app)
    {
        var meGroup = app.MapGroup("/me").RequireAuthorization();

        meGroup
            .MapGet("/profile", GetUserProfileAsync)
            .WithName("Get User Profile")
            .WithDescription("Gets user profile");

        meGroup
            .MapPost("/register", RegisterUserAsync)
            .WithName("Register User")
            .WithDescription("Creates user account and profile");

        meGroup
            .MapPatch("/profile", UpdateUserProfileAsync)
            .WithName("Update User Profile")
            .WithDescription("Updates user profile");

        meGroup
            .MapGet("/leagues", GetMyLeaguesAsync)
            .WithName("Get My Leagues")
            .WithDescription("Gets leagues owned by the authenticated user");

        meGroup
            .MapGet("/standings", GetMyStandingsAsync)
            .WithName("Get My Standings")
            .WithDescription(
                "Gets the authenticated user's latest position and total points in each league their team belongs to"
            );

        var teamGroup = meGroup.MapGroup("/team");

        teamGroup
            .MapGet("/", GetMyTeamAsync)
            .WithName("Get My Team")
            .WithDescription("Get current user's team or null if none exists");

        teamGroup
            .MapGet("/summary", GetMyTeamSummaryAsync)
            .WithName("Get My Team Summary")
            .WithDescription("Gets a summary of the current user's team this season");

        teamGroup
            .MapPost("/drivers", AddDriverToTeamAsync)
            .WithName("Add Driver to Team")
            .WithDescription("Add a driver to the current user's team at a specific slot position");

        teamGroup
            .MapDelete("/drivers/{slotPosition}", RemoveDriverFromTeamAsync)
            .WithName("Remove Driver from Team")
            .WithDescription(
                "Remove a driver from the current user's team at a specific slot position"
            );

        teamGroup
            .MapPost("/constructors", AddConstructorToTeamAsync)
            .WithName("Add Constructor to Team")
            .WithDescription(
                "Add a constructor to the current user's team at a specific slot position"
            );

        teamGroup
            .MapDelete("/constructors/{slotPosition}", RemoveConstructorFromTeamAsync)
            .WithName("Remove Constructor from Team")
            .WithDescription(
                "Remove a constructor from the current user's team at a specific slot position"
            );

        teamGroup
            .MapPut("/captain", SetCaptainAsync)
            .WithName("Set Team Captain")
            .WithDescription(
                "Set or clear the captain driver for the current race. Pass null driverId to deselect."
            );

        return app;
    }

    private static async Task<IResult> GetUserProfileAsync(
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        logger.LogDebug("Fetching current user profile");
        var user = await userProfileService.GetCurrentUserProfileAsync();

        if (user is null)
        {
            logger.LogWarning("No user profile found for authenticated user");
            return Results.Problem(
                detail: "User profile not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(user);
    }

    private static async Task<IResult> RegisterUserAsync(
        HttpContext context,
        ISupabaseAuthService authService,
        IUserProfileService userProfileService,
        RegisterUserRequest request,
        ILogger logger
    )
    {
        var userId = authService.GetRequiredUserId();
        var userEmail = authService.GetUserEmail();

        logger.LogInformation("Registering user {UserId}", userId);

        if (userEmail is null)
        {
            logger.LogWarning("Registration attempted without email for user {UserId}", userId);
            return Results.Problem(
                detail: "Email address is required for registration",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        var existingProfile = await userProfileService.GetUserProfileByAccountIdAsync(userId);
        if (existingProfile is not null)
        {
            logger.LogWarning("User {UserId} already registered", userId);
            return Results.Problem(
                detail: "User already registered",
                statusCode: StatusCodes.Status409Conflict
            );
        }

        try
        {
            var userProfile = await userProfileService.CreateUserProfileAsync(
                userId,
                userEmail,
                request.DisplayName
            );

            logger.LogInformation(
                "Successfully registered user {UserId} with profile {ProfileId}",
                userId,
                userProfile.Id
            );

            return Results.Created($"/me/profile", userProfile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to register user {UserId}", userId);
            throw;
        }
    }

    private static async Task<IResult> UpdateUserProfileAsync(
        HttpContext httpContext,
        ISupabaseAuthService authService,
        IUserProfileService userProfileService,
        UpdateUserProfileRequest updateUserProfileRequest,
        ILogger logger
    )
    {
        logger.LogInformation("Updating user profile {ProfileId}", updateUserProfileRequest.Id);

        var existingProfile = await userProfileService.GetCurrentUserProfileAsync();
        if (existingProfile is null)
        {
            logger.LogWarning("User profile not found when attempting update");
            return Results.Problem(
                detail: "User profile not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        try
        {
            var updatedProfile = await userProfileService.UpdateUserProfileAsync(
                updateUserProfileRequest
            );

            logger.LogInformation(
                "Successfully updated user profile {ProfileId}",
                updateUserProfileRequest.Id
            );

            return Results.Ok(updatedProfile);
        }
        catch (KeyNotFoundException ex)
        {
            logger.LogWarning(
                ex,
                "User profile {ProfileId} not found during update",
                updateUserProfileRequest.Id
            );
            return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status404NotFound);
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Failed to update user profile {ProfileId}",
                updateUserProfileRequest.Id
            );
            throw;
        }
    }

    private static async Task<IResult> GetMyLeaguesAsync(
        IUserProfileService userProfileService,
        ILeagueService leagueService,
        ILogger logger
    )
    {
        logger.LogDebug("Fetching leagues for current user");

        try
        {
            var user = await userProfileService.GetRequiredCurrentUserProfileAsync();
            var leagues = await leagueService.GetLeaguesForUserAsync(user.Id);

            logger.LogDebug("Retrieved {LeagueCount} leagues for current user", leagues.Count());

            return Results.Ok(leagues);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "User profile not found when fetching leagues");
            return Results.Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch leagues for current user");
            throw;
        }
    }

    private static async Task<IResult> GetMyStandingsAsync(
        ILeagueStandingsService leagueStandingsService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogDebug("Fetching standings for user {UserId}", user.Id);

        var standings = await leagueStandingsService.GetStandingsForUserAsync(user.Id);
        return Results.Ok(standings);
    }

    private static async Task<IResult> GetMyTeamAsync(
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogDebug("Fetching team for user {UserId}", user.Id);

        var team = await teamService.GetUserTeamAsync(user.Id);

        if (team is null)
        {
            logger.LogWarning("User {UserId} has no team", user.Id);
            return Results.Ok(null);
        }

        return Results.Ok(team);
    }

    private static async Task<IResult> GetMyTeamSummaryAsync(
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogDebug("Fetching team summary for user {UserId}", user.Id);

        var summary = await teamService.GetTeamSummaryAsync(user.Id);
        if (summary is null)
        {
            logger.LogWarning("User {UserId} has no team", user.Id);
            return Results.Problem(
                detail: "User has no team",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(summary);
    }

    private static async Task<IResult> AddDriverToTeamAsync(
        AddDriverToTeamRequest request,
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation(
            "User {UserId} adding driver {DriverId} at slot {SlotPosition}",
            user.Id,
            request.DriverId,
            request.SlotPosition
        );

        try
        {
            // Get user's team
            var team = await teamService.GetUserTeamAsync(user.Id);
            if (team is null)
            {
                logger.LogWarning("User {UserId} has no team", user.Id);
                return Results.Problem(
                    detail: "User has no team. Create a team first.",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }

            await teamService.AddDriverToTeamAsync(
                team.Id,
                request.DriverId,
                request.SlotPosition,
                user.Id
            );
            return Results.NoContent();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Failed to add driver to team for user {UserId}", user.Id);
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> RemoveDriverFromTeamAsync(
        int slotPosition,
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation(
            "User {UserId} removing driver from slot {SlotPosition}",
            user.Id,
            slotPosition
        );

        try
        {
            // Get user's team
            var team = await teamService.GetUserTeamAsync(user.Id);
            if (team is null)
            {
                logger.LogWarning("User {UserId} has no team", user.Id);
                return Results.Problem(
                    detail: "User has no team",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }

            await teamService.RemoveDriverFromTeamAsync(team.Id, slotPosition, user.Id);
            return Results.NoContent();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Failed to remove driver from team for user {UserId}", user.Id);
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> AddConstructorToTeamAsync(
        AddConstructorToTeamRequest request,
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation(
            "User {UserId} adding constructor {ConstructorId} at slot {SlotPosition}",
            user.Id,
            request.ConstructorId,
            request.SlotPosition
        );

        try
        {
            // Get user's team
            var team = await teamService.GetUserTeamAsync(user.Id);
            if (team is null)
            {
                logger.LogWarning("User {UserId} has no team", user.Id);
                return Results.Problem(
                    detail: "User has no team. Create a team first.",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }

            await teamService.AddConstructorToTeamAsync(
                team.Id,
                request.ConstructorId,
                request.SlotPosition,
                user.Id
            );
            return Results.NoContent();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Failed to add constructor to team for user {UserId}", user.Id);
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> RemoveConstructorFromTeamAsync(
        int slotPosition,
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation(
            "User {UserId} removing constructor from slot {SlotPosition}",
            user.Id,
            slotPosition
        );

        try
        {
            // Get user's team
            var team = await teamService.GetUserTeamAsync(user.Id);
            if (team is null)
            {
                logger.LogWarning("User {UserId} has no team", user.Id);
                return Results.Problem(
                    detail: "User has no team",
                    statusCode: StatusCodes.Status400BadRequest
                );
            }

            await teamService.RemoveConstructorFromTeamAsync(team.Id, slotPosition, user.Id);
            return Results.NoContent();
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(
                ex,
                "Failed to remove constructor from team for user {UserId}",
                user.Id
            );
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IResult> SetCaptainAsync(
        SetCaptainRequest request,
        ITeamService teamService,
        IUserProfileService userProfileService,
        ILogger logger
    )
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation(
            "User {UserId} setting captain to driver {DriverId}",
            user.Id,
            request.DriverId
        );

        var team = await teamService.GetUserTeamAsync(user.Id);
        if (team is null)
        {
            logger.LogWarning("User {UserId} has no team", user.Id);
            return Results.Problem(
                detail: "User has no team",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        await teamService.SetCaptainAsync(team.Id, request.DriverId, user.Id);
        return Results.NoContent();
    }
}
