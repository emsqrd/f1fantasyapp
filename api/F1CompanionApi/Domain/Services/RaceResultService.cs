using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IRaceResultService
{
    Task<IEnumerable<DriverQualifyingResultResponse>> SubmitQualifyingResultsAsync(
        int raceId,
        List<QualifyingResultItem> qualifyingItems
    );
    Task<IEnumerable<DriverRaceResultResponse>> SubmitRaceResultsAsync(
        int raceId,
        SessionType sessionType,
        List<RaceResultItem> raceItems
    );
    Task<IEnumerable<DriverQualifyingResultResponse>> GetQualifyingResultsAsync(int raceId);
    Task<IEnumerable<DriverRaceResultResponse>> GetRaceResultsAsync(
        int raceId,
        SessionType sessionType
    );
}

public class RaceResultService : IRaceResultService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RaceResultService> _logger;

    public RaceResultService(ApplicationDbContext dbContext, ILogger<RaceResultService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Saves qualifying results for a race, replacing any previously submitted results.
    /// Can be safely rerun to apply corrections, such as position changes after a stewards' review.
    /// </summary>
    /// <param name="raceId">The ID of the race to submit qualifying results for.</param>
    /// <param name="qualifyingItems">The qualifying result items to save.</param>
    public async Task<IEnumerable<DriverQualifyingResultResponse>> SubmitQualifyingResultsAsync(
        int raceId,
        List<QualifyingResultItem> qualifyingItems
    )
    {
        _logger.LogInformation(
            "Submitting {Count} qualifying results for race {RaceId}",
            qualifyingItems.Count,
            raceId
        );

        var race = await _dbContext.Races.FindAsync(raceId);

        if (race is null)
            throw new KeyNotFoundException($"Race {raceId} not found");

        ValidateQualifyingItems(qualifyingItems);
        await ValidateDriversExistAsync(qualifyingItems.Select(i => i.DriverId).ToList());

        // Delete any existing results so new ones can be created
        var existingQualifying = await _dbContext
            .DriverQualifyingResults.Where(r => r.RaceId == raceId)
            .ToListAsync();
        _dbContext.DriverQualifyingResults.RemoveRange(existingQualifying);

        var entities = qualifyingItems
            .Select(i => new DriverQualifyingResult
            {
                DriverId = i.DriverId,
                RaceId = raceId,
                Position = i.Position,
            })
            .ToList();

        _dbContext.DriverQualifyingResults.AddRange(entities);
        await _dbContext.SaveChangesAsync();

        return entities.ToResponseModel();
    }

    /// <summary>
    /// Saves race or sprint results for a race, replacing any previously submitted results.
    /// Can be safely rerun to apply corrections, such as status changes after a disqualification.
    /// </summary>
    /// <param name="raceId">The ID of the race to submit results for.</param>
    /// <param name="sessionType">The session type (Race or Sprint).</param>
    /// <param name="raceItems">The race result items to save.</param>
    public async Task<IEnumerable<DriverRaceResultResponse>> SubmitRaceResultsAsync(
        int raceId,
        SessionType sessionType,
        List<RaceResultItem> raceItems
    )
    {
        _logger.LogInformation(
            "Submitting {Count} {SessionType} results for race {RaceId}",
            raceItems.Count,
            sessionType,
            raceId
        );

        var race = await _dbContext.Races.FindAsync(raceId);
        if (race is null)
            throw new KeyNotFoundException($"Race {raceId} not found");

        if (sessionType == SessionType.Sprint && !race.HasSprint)
            throw new SprintNotAvailableException(raceId);

        ValidateRaceItems(raceItems);
        await ValidateDriversExistAsync(raceItems.Select(i => i.DriverId).ToList());

        // Delete any existing results so new ones can be created
        var existingRace = await _dbContext
            .DriverRaceResults.Where(r => r.RaceId == raceId && r.SessionType == sessionType)
            .ToListAsync();
        _dbContext.DriverRaceResults.RemoveRange(existingRace);

        var entities = raceItems
            .Select(i => new DriverRaceResult
            {
                DriverId = i.DriverId,
                RaceId = raceId,
                SessionType = sessionType,
                GridPosition = i.GridPosition,
                FinishPosition = i.FinishPosition,
                Overtakes = i.Overtakes,
                FastestLap = i.FastestLap,
                Status = i.Status,
            })
            .ToList();

        _dbContext.DriverRaceResults.AddRange(entities);
        await _dbContext.SaveChangesAsync();

        return entities.ToResponseModel();
    }

    /// <summary>
    /// Returns all qualifying results for a race, ordered by position.
    /// </summary>
    /// <param name="raceId">The ID of the race to retrieve qualifying results for.</param>
    public async Task<IEnumerable<DriverQualifyingResultResponse>> GetQualifyingResultsAsync(
        int raceId
    )
    {
        _logger.LogDebug("Fetching qualifying results for race {RaceId}", raceId);

        var results = await _dbContext
            .DriverQualifyingResults.Where(r => r.RaceId == raceId)
            .OrderBy(r => r.Position)
            .ToListAsync();

        return results.ToResponseModel();
    }

    /// <summary>
    /// Returns all race or sprint results for a race, ordered by finish position.
    /// </summary>
    /// <param name="raceId">The ID of the race to retrieve results for.</param>
    /// <param name="sessionType">The session type (Race or Sprint).</param>
    public async Task<IEnumerable<DriverRaceResultResponse>> GetRaceResultsAsync(
        int raceId,
        SessionType sessionType
    )
    {
        _logger.LogDebug("Fetching {SessionType} results for race {RaceId}", sessionType, raceId);

        var results = await _dbContext
            .DriverRaceResults.Where(r => r.RaceId == raceId && r.SessionType == sessionType)
            .OrderBy(r => r.FinishPosition)
            .ToListAsync();

        return results.ToResponseModel();
    }

    /// <summary>
    /// Validates that no duplicate driverIds appear in the batch.
    /// </summary>
    /// <param name="qualifyingItems">The qualifying result items to validate.</param>
    private static void ValidateQualifyingItems(List<QualifyingResultItem> qualifyingItems)
    {
        var duplicates = qualifyingItems
            .GroupBy(i => i.DriverId)
            .Where(g => g.Count() > 1)
            .ToList();
        if (duplicates.Count > 0)
            throw new ArgumentException(
                $"Duplicate driverIds in batch: {string.Join(", ", duplicates.Select(g => g.Key))}"
            );
    }

    /// <summary>
    /// Validates duplicate driverIds, fastest lap count, and FinishPosition/Status consistency.
    /// </summary>
    /// <param name="raceItems">The race result items to validate.</param>
    private static void ValidateRaceItems(List<RaceResultItem> raceItems)
    {
        var duplicates = raceItems.GroupBy(i => i.DriverId).Where(g => g.Count() > 1).ToList();
        if (duplicates.Count > 0)
            throw new ArgumentException(
                $"Duplicate driverIds in batch: {string.Join(", ", duplicates.Select(g => g.Key))}"
            );

        if (raceItems.Count(i => i.FastestLap) > 1)
            throw new ArgumentException(
                "At most one driver can have FastestLap = true per session"
            );

        // Validate finish position is consistent with status for each driver
        foreach (var item in raceItems)
        {
            var finishPositionRequired =
                item.Status == RaceStatus.Classified && item.FinishPosition is null;
            var finishPositionForbidden =
                item.Status != RaceStatus.Classified && item.FinishPosition is not null;

            if (finishPositionRequired)
                throw new ArgumentException(
                    $"Driver {item.DriverId}: FinishPosition is required when Status is Classified"
                );

            if (finishPositionForbidden)
                throw new ArgumentException(
                    $"Driver {item.DriverId}: FinishPosition must be null when Status is {item.Status}"
                );
        }
    }

    /// <summary>
    /// Throws if any driverIds in the batch do not exist in the database.
    /// </summary>
    /// <param name="driverIds">The driver IDs to check for existence.</param>
    private async Task ValidateDriversExistAsync(List<int> driverIds)
    {
        var existingIds = await _dbContext
            .Drivers.Where(d => driverIds.Contains(d.Id))
            .Select(d => d.Id)
            .ToListAsync();

        var missing = driverIds.Except(existingIds).ToList();
        if (missing.Count > 0)
            throw new ArgumentException($"Driver(s) not found: {string.Join(", ", missing)}");
    }
}
