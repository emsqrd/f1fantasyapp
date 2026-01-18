namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to directly join a private league without an invitation.
/// This is considered exceptional because the UI should only display public leagues in
/// browse/search views, or provide invitation methods for private leagues, indicating a
/// client-side validation failure or URL manipulation.
/// </summary>
public class LeagueIsPrivateException : Exception
{
    /// <summary>
    /// Gets the ID of the private league.
    /// </summary>
    public int LeagueId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="LeagueIsPrivateException"/> class.
    /// </summary>
    /// <param name="leagueId">The ID of the private league.</param>
    public LeagueIsPrivateException(int leagueId)
        : base($"League {leagueId} is private and requires an invitation")
    {
        LeagueId = leagueId;
    }
}
