namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when attempting to validate or use an invite token that is invalid,
/// malformed, or doesn't exist in the database. This is considered exceptional because
/// invite tokens should only come from league owners who generated them through the UI,
/// indicating either URL manipulation, expired/deleted tokens, or corrupted token data.
/// </summary>
public class InvalidLeagueInviteTokenException : Exception
{
    /// <summary>
    /// Gets the invalid invite token that was attempted.
    /// </summary>
    public string InviteToken { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="InvalidLeagueInviteTokenException"/> class.
    /// </summary>
    /// <param name="inviteToken">The invalid invite token.</param>
    public InvalidLeagueInviteTokenException(string inviteToken)
        : base($"The invite link is invalid")
    {
        InviteToken = inviteToken;
    }
}
