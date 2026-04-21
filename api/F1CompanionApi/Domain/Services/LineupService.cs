using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ILineupService
{
    Task AdvanceLineupsAsync(int raceWeekendId);
}

public class LineupService : ILineupService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LineupService> _logger;

    public LineupService(ApplicationDbContext dbContext, ILogger<LineupService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Carries each team's lineup forward so players start the next race weekend with their
    /// previous selections. Teams that have already made changes for the next weekend are left
    /// alone, so this can safely be run more than once. Does nothing when the season has no
    /// more races. Throws <see cref="NextRoundLockedException"/> if the next weekend's lineup
    /// is already locked.
    /// </summary>
    /// <param name="raceWeekendId">The race weekend whose lineups should be carried forward.</param>
    public async Task AdvanceLineupsAsync(int raceWeekendId)
    {
        var current =
            await _dbContext.RaceWeekends.FindAsync(raceWeekendId)
            ?? throw new InvalidOperationException($"RaceWeekend {raceWeekendId} not found");

        var nextRaceWeekend = await _dbContext.RaceWeekends.FirstOrDefaultAsync(rw =>
            rw.SeasonId == current.SeasonId && rw.Round == current.Round + 1
        );

        if (nextRaceWeekend is null)
        {
            _logger.LogInformation(
                "Skipped carrying lineups forward from season {SeasonId} round {Round}: season is over",
                current.SeasonId,
                current.Round
            );
            return;
        }

        if (nextRaceWeekend.LockDeadline is { } deadline && deadline <= DateTime.UtcNow)
            throw new NextRoundLockedException(nextRaceWeekend.Round, deadline);

        var rowsToCopy = await _dbContext
            .LineupEntries.Where(le =>
                le.RaceWeekendId == current.Id
                && !_dbContext.LineupEntries.Any(x =>
                    x.RaceWeekendId == nextRaceWeekend.Id && x.TeamId == le.TeamId
                )
            )
            .ToListAsync();

        if (rowsToCopy.Count == 0)
        {
            _logger.LogInformation(
                "Nothing to carry forward from season {SeasonId} round {Round}: every team already has a lineup for round {NextRound}",
                current.SeasonId,
                current.Round,
                nextRaceWeekend.Round
            );
            return;
        }

        var now = DateTime.UtcNow;
        var newRows = rowsToCopy.Select(le => new LineupEntry
        {
            TeamId = le.TeamId,
            RaceWeekendId = nextRaceWeekend.Id,
            EntityId = le.EntityId,
            EntityType = le.EntityType,
            SlotPosition = le.SlotPosition,
            IsCaptain = le.IsCaptain,
            CreatedAt = now,
        });
        _dbContext.LineupEntries.AddRange(newRows);
        await _dbContext.SaveChangesAsync();

        var teamsCopied = rowsToCopy.Select(r => r.TeamId).Distinct().Count();
        _logger.LogInformation(
            "Carried {TeamsCopied} lineups forward from season {SeasonId} round {Round} to round {NextRound}",
            teamsCopied,
            current.SeasonId,
            current.Round,
            nextRaceWeekend.Round
        );
    }
}
