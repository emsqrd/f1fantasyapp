using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Extensions;

public static class UserProfileExtensions
{
    /// <summary>
    /// Gets the full name of the user by combining FirstName and LastName.
    /// Handles null values gracefully and trims extra whitespace.
    /// </summary>
    /// <param name="profile">The user profile</param>
    /// <returns>Full name with proper spacing, or empty string if both names are null/whitespace</returns>
    public static string GetFullName(this UserProfile profile)
    {
        return string.Join(" ", new[] { profile.FirstName, profile.LastName }
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Select(s => s.Trim()));
    }
}
