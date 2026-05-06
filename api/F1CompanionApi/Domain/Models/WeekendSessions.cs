using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Domain.Models;

public static class WeekendSessions
{
    /// <summary>
    /// Sessions that occur in the given weekend format, in F1 chronological order.
    /// </summary>
    public static IReadOnlyList<SessionType> InOrder(WeekendFormat format) =>
        format switch
        {
            WeekendFormat.Standard => [SessionType.Qualifying, SessionType.GrandPrix],
            WeekendFormat.Sprint =>
            [
                SessionType.Sprint,
                SessionType.Qualifying,
                SessionType.GrandPrix,
            ],
            _ => throw new ArgumentOutOfRangeException(nameof(format)),
        };
}
