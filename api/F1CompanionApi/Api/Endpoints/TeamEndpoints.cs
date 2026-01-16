using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace F1CompanionApi.Api.Endpoints;

public static class TeamEndpoints
{
    public static IEndpointRouteBuilder MapTeamEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/teams", CreateTeamAsync)
            .RequireAuthorization()
            .WithName("CreateTeam")
            .WithOpenApi()
            .WithDescription("Create a new team for the current user");

        app.MapGet("/teams", GetTeams)
            .WithName("GetTeams")
            .WithOpenApi()
            .WithDescription("Gets all teams");

        app.MapGet("/teams/{id}", GetTeamByIdAsync)
            .WithName("GetTeamById")
            .WithOpenApi()
            .WithDescription("Get Team By Id");

        return app;
    }

    private static async Task<IResult> CreateTeamAsync(
        CreateTeamRequest request,
        ITeamService teamService,
        IUserProfileService userProfileService,
        [FromServices] ILogger logger)
    {
        var user = await userProfileService.GetRequiredCurrentUserProfileAsync();

        logger.LogInformation("User {UserId} creating team", user.Id);

        try
        {
            var team = await teamService.CreateTeamAsync(request, user.Id);
            return Results.Created($"/teams/{team.Id}", team);
        }
        catch (InvalidOperationException ex)
        {
            logger.LogWarning(ex, "Failed to create team for user {UserId}", user.Id);
            return Results.BadRequest(ex.Message);
        }
    }

    private static async Task<IEnumerable<Team>> GetTeams(
        ApplicationDbContext db,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching all teams");
        var teams = await db.Teams.ToListAsync() ?? [];
        logger.LogDebug("Retrieved {TeamCount} teams", teams.Count);
        return teams;
    }

    private static async Task<IResult> GetTeamByIdAsync(
        int id,
        ApplicationDbContext db,
        [FromServices] ILogger logger)
    {
        logger.LogDebug("Fetching team {TeamId}", id);
        
        var team = await db.Teams
            .Include(t => t.Owner)
            .Include(t => t.TeamDrivers)
                .ThenInclude(td => td.Driver)
            .Include(t => t.TeamConstructors)
                .ThenInclude(tc => tc.Constructor)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (team is null)
        {
            logger.LogWarning("Team {TeamId} not found", id);
            return Results.Problem(
                detail: "Team not found",
                statusCode: StatusCodes.Status404NotFound
            );
        }

        return Results.Ok(team.ToDetailsResponseModel());
    }
}
