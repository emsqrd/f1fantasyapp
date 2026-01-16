namespace F1CompanionApi.Domain.Exceptions;

/// <summary>
/// Exception thrown when an authenticated user's profile cannot be found.
/// This is considered exceptional because a user profile should always exist after successful authentication.
/// Indicates a data integrity issue that requires investigation.
/// </summary>
public class UserProfileNotFoundException : Exception
{
    /// <summary>
    /// Gets the account ID of the user whose profile was not found.
    /// </summary>
    public string AccountId { get; init; }

    /// <summary>
    /// Initializes a new instance of the <see cref="UserProfileNotFoundException"/> class.
    /// </summary>
    /// <param name="accountId">The account ID of the user whose profile was not found.</param>
    public UserProfileNotFoundException(string accountId)
        : base($"User profile not found for account {accountId}")
    {
        AccountId = accountId;
    }
}
