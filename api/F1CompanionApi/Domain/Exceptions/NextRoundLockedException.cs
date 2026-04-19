namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when <c>advance-lineups</c> is called on a race weekend whose next round's
/// lock deadline has already passed. This is considered exceptional because it implies the
/// ingest pipeline ran so late that users can no longer edit their Round N+1 lineups — the
/// automated carry-forward would overwrite choices the UI already treats as locked-in, so it
/// requires operator intervention rather than a silent fix.
/// </summary>
public class NextRoundLockedException : Exception
{
    /// <summary>
    /// Gets the round number whose lock deadline has passed.
    /// </summary>
    public int NextRound { get; init; }

    /// <summary>
    /// Gets the lock deadline that was missed.
    /// </summary>
    public DateTime LockedAt { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="NextRoundLockedException"/> class.
    /// </summary>
    /// <param name="nextRound">The round number whose lock deadline has passed.</param>
    /// <param name="lockedAt">The lock deadline that was missed.</param>
    public NextRoundLockedException(int nextRound, DateTime lockedAt)
        : base($"Cannot advance lineups: Round {nextRound} is locked as of {lockedAt:O}")
    {
        NextRound = nextRound;
        LockedAt = lockedAt;
    }
}
