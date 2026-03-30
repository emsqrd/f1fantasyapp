using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class RaceResultEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapRaceResultEndpoints(this IEndpointRouteBuilder app)
    {
        var resultsGroup = app.MapGroup("/races/{raceId}/results")
            .RequireAuthorization()
            .WithOpenApi();

        resultsGroup
            .MapPut("/qualifying", SubmitQualifyingResultsAsync)
            .WithName("SubmitQualifyingResults")
            .WithDescription(
                "Submit qualifying results for a race, replacing any existing results"
            );

        resultsGroup
            .MapGet("/qualifying", GetQualifyingResultsAsync)
            .WithName("GetQualifyingResults")
            .WithDescription("Get qualifying results for a race");

        resultsGroup
            .MapPut("/race", SubmitRaceResultsAsync)
            .WithName("SubmitRaceResults")
            .WithDescription("Submit race results for a race, replacing any existing results");

        resultsGroup
            .MapGet("/race", GetRaceResultsAsync)
            .WithName("GetRaceResults")
            .WithDescription("Get race results for a race");

        resultsGroup
            .MapPut("/sprint", SubmitSprintResultsAsync)
            .WithName("SubmitSprintResults")
            .WithDescription("Submit sprint results for a race, replacing any existing results");

        resultsGroup
            .MapGet("/sprint", GetSprintResultsAsync)
            .WithName("GetSprintResults")
            .WithDescription("Get sprint results for a race");

        return app;
    }

    private static async Task<IResult> SubmitQualifyingResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromBody] List<QualifyingResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation("Submitting qualifying results for race {RaceId}", raceId);

        var results = await raceResultService.SubmitQualifyingResultsAsync(raceId, items);

        return Results.Ok(results);
    }

    private static async Task<IResult> GetQualifyingResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching qualifying results for race {RaceId}", raceId);

        var results = await raceResultService.GetQualifyingResultsAsync(raceId);

        return Results.Ok(results);
    }

    private static async Task<IResult> SubmitRaceResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromBody] List<RaceResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation("Submitting race results for race {RaceId}", raceId);

        var results = await raceResultService.SubmitRaceResultsAsync(
            raceId,
            SessionType.Race,
            items
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> GetRaceResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching race results for race {RaceId}", raceId);

        var results = await raceResultService.GetRaceResultsAsync(raceId, SessionType.Race);

        return Results.Ok(results);
    }

    private static async Task<IResult> SubmitSprintResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromBody] List<RaceResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation("Submitting sprint results for race {RaceId}", raceId);

        var results = await raceResultService.SubmitRaceResultsAsync(
            raceId,
            SessionType.Sprint,
            items
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> GetSprintResultsAsync(
        IRaceResultService raceResultService,
        int raceId,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug("Fetching sprint results for race {RaceId}", raceId);

        var results = await raceResultService.GetRaceResultsAsync(raceId, SessionType.Sprint);

        return Results.Ok(results);
    }
}
