namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to join a league that has reached its maximum team capacity.
/// This is considered exceptional because the UI should disable join functionality when a
/// league is at capacity, indicating a client-side validation failure or a race condition
/// where the last spot was filled between page load and join attempt.
/// </summary>
public class LeagueFullException : Exception
{
    /// <summary>
    /// Gets the ID of the league that is full.
    /// </summary>
    public int LeagueId { get; init; }

    /// <summary>
    /// Gets the maximum number of teams allowed in the league.
    /// </summary>
    public int MaxTeams { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="LeagueFullException"/> class.
    /// </summary>
    /// <param name="leagueId">The ID of the league that is full.</param>
    /// <param name="maxTeams">The maximum number of teams allowed in the league.</param>
    public LeagueFullException(int leagueId, int maxTeams)
        : base($"League {leagueId} is full (max {maxTeams} teams)")
    {
        LeagueId = leagueId;
        MaxTeams = maxTeams;
    }
}
