namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when a user attempts to read a private league's details or
/// standings without being a member of that league. This is considered exceptional
/// because the UI surfaces private leagues only to their members, so any request
/// reaching the API for a private league the caller does not belong to indicates
/// a client-side bug or URL manipulation.
/// </summary>
public class NotLeagueMemberException : Exception
{
    public int LeagueId { get; init; }
    public int UserId { get; init; }

    public NotLeagueMemberException(int leagueId, int userId)
        : base($"User {userId} is not a member of league {leagueId}")
    {
        LeagueId = leagueId;
        UserId = userId;
    }
}
