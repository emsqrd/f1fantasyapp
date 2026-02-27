namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when an operation requires an upcoming race but none exists on the calendar.
/// This is considered exceptional because the UI should disable race-dependent actions (e.g. setting
/// a captain) when no upcoming race is scheduled, indicating a client-side bug or race condition.
/// </summary>
public class NoUpcomingRaceException : Exception
{
    public NoUpcomingRaceException()
        : base("There is no upcoming race to perform this operation.") { }
}
