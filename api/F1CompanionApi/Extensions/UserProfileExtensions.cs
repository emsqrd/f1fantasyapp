using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Extensions;

public static class UserProfileExtensions
{
    /// <summary>
    /// Gets the display name for the user, preferring FirstName + LastName combination.
    /// Falls back to DisplayName if first and last names are not available.
    /// Handles null values gracefully and trims extra whitespace.
    /// </summary>
    /// <param name="profile">The user profile</param>
    /// <returns>Full name, DisplayName, or empty string if all values are null/whitespace</returns>
    public static string GetFullName(this UserProfile profile)
    {
        var fullName = string.Join(" ",
            from s in new[] { profile.FirstName, profile.LastName }
            where s != null && !string.IsNullOrWhiteSpace(s)
            select s.Trim());

        return !string.IsNullOrWhiteSpace(fullName)
            ? fullName
            : profile.DisplayName ?? string.Empty;
    }
}
