namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to submit sprint results for a race that does not have a sprint session.
/// This is considered exceptional because callers should check <c>RaceWeekend.WeekendFormat</c> before submitting
/// sprint results, indicating either a client error or a misconfigured race record.
/// </summary>
public class SprintNotAvailableException : Exception
{
    /// <summary>
    /// Gets the ID of the race that does not have a sprint session.
    /// </summary>
    public int RaceWeekendId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="SprintNotAvailableException"/> class.
    /// </summary>
    /// <param name="raceWeekendId">The ID of the race that does not have a sprint session.</param>
    public SprintNotAvailableException(int raceWeekendId)
        : base($"Race Weekend {raceWeekendId} does not have a sprint session")
    {
        RaceWeekendId = raceWeekendId;
    }
}
