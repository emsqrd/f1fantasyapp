namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to join a league that the team is already a member of.
/// This is considered exceptional because the UI should hide join buttons and display
/// "already joined" status for leagues the user's team belongs to, indicating a
/// client-side validation failure or a race condition.
/// </summary>
public class AlreadyInLeagueException : Exception
{
    /// <summary>
    /// Gets the ID of the league.
    /// </summary>
    public int LeagueId { get; init; }

    /// <summary>
    /// Gets the ID of the team that is already a member.
    /// </summary>
    public int TeamId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="AlreadyInLeagueException"/> class.
    /// </summary>
    /// <param name="leagueId">The ID of the league.</param>
    /// <param name="teamId">The ID of the team that is already a member.</param>
    public AlreadyInLeagueException(int leagueId, int teamId)
        : base($"Team {teamId} is already a member of league {leagueId}")
    {
        LeagueId = leagueId;
        TeamId = teamId;
    }
}
