namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to access a league that does not exist.
/// This is considered exceptional because league IDs should come from valid sources
/// (search results, invitations, user's leagues). A not found error typically indicates
/// deleted data, URL manipulation, or a race condition.
/// </summary>
public class LeagueNotFoundException : Exception
{
    /// <summary>
    /// Gets the ID of the league that was not found.
    /// </summary>
    public int LeagueId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="LeagueNotFoundException"/> class.
    /// </summary>
    /// <param name="leagueId">The ID of the league that was not found.</param>
    public LeagueNotFoundException(int leagueId)
        : base($"League {leagueId} not found")
    {
        LeagueId = leagueId;
    }
}
