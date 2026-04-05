using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Data;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Api.Endpoints;

public static class DebugScoringEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapDebugScoringEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/debug/score")
            .RequireAuthorization()
            .WithOpenApi()
            .MapGet("/race/{raceId}", ScoreRaceAsync)
            .WithName("ScoreRace")
            .WithDescription(
                "Score all entities and teams for a race, replacing any existing scores"
            );

        return app;
    }

    private static async Task<IResult> ScoreRaceAsync(
        IScoringService scoringService,
        ApplicationDbContext dbContext,
        int raceId,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation("Scoring all entities and teams for race {RaceId}", raceId);

        await scoringService.ScoreRaceEntitiesAsync(raceId);
        await scoringService.ScoreTeamsForRaceAsync(raceId);

        var result = new
        {
            DriverScores = await dbContext
                .DriverRaceScores.Where(d => d.RaceId == raceId)
                .ToListAsync(),
            ConstructorScores = await dbContext
                .ConstructorRaceScores.Where(c => c.RaceId == raceId)
                .ToListAsync(),
            TeamScores = await dbContext
                .TeamRaceScores.Where(t => t.RaceId == raceId)
                .ToListAsync(),
        };

        return Results.Ok(result);
    }
}
