namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when a lineup change is attempted after the lock deadline has passed.
/// This is considered exceptional because the UI disables lineup changes once locked,
/// indicating either a race condition or a request that bypassed the client.
/// </summary>
public class LineupLockedException(string raceName, DateTime lockDeadline)
    : Exception($"Lineup is locked for {raceName} (lock deadline: {lockDeadline:u})")
{
    /// <summary>
    /// Gets the name of the race whose lock deadline has passed.
    /// </summary>
    public string RaceName { get; } = raceName;

    /// <summary>
    /// Gets the UTC deadline after which lineup changes are no longer permitted.
    /// </summary>
    public DateTime LockDeadline { get; } = lockDeadline;
}
