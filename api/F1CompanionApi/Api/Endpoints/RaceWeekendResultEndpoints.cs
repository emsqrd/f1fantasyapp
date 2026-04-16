using System.Diagnostics.CodeAnalysis;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Mvc;

namespace F1CompanionApi.Api.Endpoints;

public static class RaceWeekendResultEndpoints
{
    [ExcludeFromCodeCoverage]
    public static IEndpointRouteBuilder MapRaceWeekendResultEndpoints(
        this IEndpointRouteBuilder app
    )
    {
        var resultsGroup = app.MapGroup("/seasons/{seasonId}/race-weekends/{round}/results")
            .RequireAuthorization()
            .WithOpenApi();

        resultsGroup
            .MapPut("/qualifying", SubmitQualifyingResultsAsync)
            .WithName("SubmitQualifyingResults")
            .WithDescription(
                "Submit qualifying results for a race weekend, replacing any existing results"
            );

        resultsGroup
            .MapGet("/qualifying", GetQualifyingResultsAsync)
            .WithName("GetQualifyingResults")
            .WithDescription("Get qualifying results for a race weekend");

        resultsGroup
            .MapPut("/sprint", SubmitSprintResultsAsync)
            .WithName("SubmitSprintResults")
            .WithDescription(
                "Submit sprint results for a race weekend, replacing any existing results"
            );

        resultsGroup
            .MapGet("/sprint", GetSprintResultsAsync)
            .WithName("GetSprintResults")
            .WithDescription("Get sprint results for a race weekend");

        resultsGroup
            .MapPut("/grand-prix", SubmitGrandPrixResultsAsync)
            .WithName("SubmitGrandPrixResults")
            .WithDescription(
                "Submit Grand Prix results for a race weekend, replacing any existing results"
            );

        resultsGroup
            .MapGet("/grand-prix", GetGrandPrixResultsAsync)
            .WithName("GetGrandPrixResults")
            .WithDescription("Get Grand Prix results for a race weekend");

        return app;
    }

    private static async Task<int?> ResolveRaceWeekendIdAsync(
        IRaceWeekendService raceWeekendService,
        ILogger logger,
        int seasonId,
        int round
    )
    {
        var id = await raceWeekendService.GetIdByRoundAsync(seasonId, round);
        if (id is null)
            logger.LogWarning(
                "Race weekend for season {SeasonId}, round {Round} not found",
                seasonId,
                round
            );
        return id;
    }

    private static async Task<IResult> SubmitQualifyingResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromBody] List<QualifyingResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation(
            "Submitting qualifying results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.SubmitQualifyingResultsAsync(
            raceWeekendId.Value,
            items
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> GetQualifyingResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug(
            "Fetching qualifying results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.GetQualifyingResultsAsync(raceWeekendId.Value);

        return Results.Ok(results);
    }

    private static async Task<IResult> SubmitSprintResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromBody] List<RacingResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation(
            "Submitting sprint results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.SubmitRaceResultsAsync(
            raceWeekendId.Value,
            SessionType.Sprint,
            items
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> GetSprintResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug(
            "Fetching sprint results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.GetRaceResultsAsync(
            raceWeekendId.Value,
            SessionType.Sprint
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> SubmitGrandPrixResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromBody] List<RacingResultItem> items,
        [FromServices] ILogger logger
    )
    {
        logger.LogInformation(
            "Submitting Grand Prix results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.SubmitRaceResultsAsync(
            raceWeekendId.Value,
            SessionType.GrandPrix,
            items
        );

        return Results.Ok(results);
    }

    private static async Task<IResult> GetGrandPrixResultsAsync(
        IRaceWeekendService raceWeekendService,
        IRaceWeekendResultService raceWeekendResultService,
        int seasonId,
        int round,
        [FromServices] ILogger logger
    )
    {
        logger.LogDebug(
            "Fetching Grand Prix results for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekendId = await ResolveRaceWeekendIdAsync(
            raceWeekendService,
            logger,
            seasonId,
            round
        );
        if (raceWeekendId is null)
            return Results.Problem(
                detail: "Race weekend not found",
                statusCode: StatusCodes.Status404NotFound
            );

        var results = await raceWeekendResultService.GetRaceResultsAsync(
            raceWeekendId.Value,
            SessionType.GrandPrix
        );

        return Results.Ok(results);
    }
}
