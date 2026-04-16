using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IRaceWeekendResultService
{
    Task<IEnumerable<DriverQualifyingResultResponse>> SubmitQualifyingResultsAsync(
        int raceWeekendId,
        List<QualifyingResultItem> qualifyingItems
    );
    Task<IEnumerable<DriverRacingResultResponse>> SubmitRaceResultsAsync(
        int raceWeekendId,
        SessionType sessionType,
        List<RacingResultItem> raceItems
    );
    Task<IEnumerable<DriverQualifyingResultResponse>> GetQualifyingResultsAsync(int raceWeekendId);
    Task<IEnumerable<DriverRacingResultResponse>> GetRaceResultsAsync(
        int raceWeekendId,
        SessionType sessionType
    );
}

public class RaceWeekendResultService : IRaceWeekendResultService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RaceWeekendResultService> _logger;

    public RaceWeekendResultService(
        ApplicationDbContext dbContext,
        ILogger<RaceWeekendResultService> logger
    )
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
    /// <param name="raceWeekendId">The ID of the race weekend to submit qualifying results for.</param>
    /// <param name="qualifyingItems">The qualifying result items to save.</param>
    public async Task<IEnumerable<DriverQualifyingResultResponse>> SubmitQualifyingResultsAsync(
        int raceWeekendId,
        List<QualifyingResultItem> qualifyingItems
    )
    {
        _logger.LogInformation(
            "Submitting {Count} qualifying results for race weekend {RaceWeekendId}",
            qualifyingItems.Count,
            raceWeekendId
        );

        var race = await _dbContext.RaceWeekends.FindAsync(raceWeekendId);

        if (race is null)
            throw new KeyNotFoundException($"Race weekend {raceWeekendId} not found");

        ValidateQualifyingItems(qualifyingItems);
        await ValidateDriversExistAsync(qualifyingItems.Select(i => i.DriverId).ToList());

        // Delete any existing results so new ones can be created
        var existingQualifying = await _dbContext
            .DriverQualifyingResults.Where(r => r.RaceWeekendId == raceWeekendId)
            .ToListAsync();
        _dbContext.DriverQualifyingResults.RemoveRange(existingQualifying);

        var entities = qualifyingItems
            .Select(i => new DriverQualifyingResult
            {
                DriverId = i.DriverId,
                RaceWeekendId = raceWeekendId,
                Position = i.Position,
                CreatedAt = DateTime.UtcNow,
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
    /// <param name="raceWeekendId">The ID of the race weekend to submit results for.</param>
    /// <param name="sessionType">The session type (GrandPrix or Sprint).</param>
    /// <param name="raceItems">The race result items to save.</param>
    public async Task<IEnumerable<DriverRacingResultResponse>> SubmitRaceResultsAsync(
        int raceWeekendId,
        SessionType sessionType,
        List<RacingResultItem> raceItems
    )
    {
        _logger.LogInformation(
            "Submitting {Count} {SessionType} results for race weekend {RaceWeekendId}",
            raceItems.Count,
            sessionType,
            raceWeekendId
        );

        var race = await _dbContext.RaceWeekends.FindAsync(raceWeekendId);
        if (race is null)
            throw new KeyNotFoundException($"Race weekend {raceWeekendId} not found");

        if (sessionType == SessionType.Sprint && race.WeekendFormat != WeekendFormat.Sprint)
            throw new SprintNotAvailableException(raceWeekendId);

        ValidateRaceItems(raceItems);
        await ValidateDriversExistAsync(raceItems.Select(i => i.DriverId).ToList());

        // Delete any existing results so new ones can be created
        var existingRace = await _dbContext
            .DriverRacingResults.Where(r =>
                r.RaceWeekendId == raceWeekendId && r.SessionType == sessionType
            )
            .ToListAsync();
        _dbContext.DriverRacingResults.RemoveRange(existingRace);

        var entities = raceItems
            .Select(i => new DriverRacingResult
            {
                DriverId = i.DriverId,
                RaceWeekendId = raceWeekendId,
                SessionType = sessionType,
                GridPosition = i.GridPosition,
                FinishPosition = i.FinishPosition,
                Overtakes = i.Overtakes,
                FastestLap = i.FastestLap,
                Status = i.Status,
                CreatedAt = DateTime.UtcNow,
            })
            .ToList();

        _dbContext.DriverRacingResults.AddRange(entities);
        await _dbContext.SaveChangesAsync();

        return entities.ToResponseModel();
    }

    /// <summary>
    /// Returns all qualifying results for a race, ordered by position.
    /// </summary>
    /// <param name="raceWeekendId">The ID of the race weekend to retrieve qualifying results for.</param>
    public async Task<IEnumerable<DriverQualifyingResultResponse>> GetQualifyingResultsAsync(
        int raceWeekendId
    )
    {
        _logger.LogDebug(
            "Fetching qualifying results for race weekend {RaceWeekendId}",
            raceWeekendId
        );

        var results = await _dbContext
            .DriverQualifyingResults.Where(r => r.RaceWeekendId == raceWeekendId)
            .OrderBy(r => r.Position)
            .ToListAsync();

        return results.ToResponseModel();
    }

    /// <summary>
    /// Returns all race or sprint results for a race, ordered by finish position.
    /// </summary>
    /// <param name="raceWeekendId">The ID of the race weekend to retrieve results for.</param>
    /// <param name="sessionType">The session type (GrandPrix or Sprint).</param>
    public async Task<IEnumerable<DriverRacingResultResponse>> GetRaceResultsAsync(
        int raceWeekendId,
        SessionType sessionType
    )
    {
        _logger.LogDebug(
            "Fetching {SessionType} results for race weekend {RaceWeekendId}",
            sessionType,
            raceWeekendId
        );

        var results = await _dbContext
            .DriverRacingResults.Where(r =>
                r.RaceWeekendId == raceWeekendId && r.SessionType == sessionType
            )
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
    private static void ValidateRaceItems(List<RacingResultItem> raceItems)
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
                item.Status == RacingStatus.Classified && item.FinishPosition is null;
            var finishPositionForbidden =
                item.Status != RacingStatus.Classified && item.FinishPosition is not null;

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
