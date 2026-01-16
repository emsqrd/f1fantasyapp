namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Represents a user profile with display information and account details.
/// </summary>
public class UserProfile
{
    public int Id { get; set; }
    public required string AccountId { get; set; }
    public string? DisplayName { get; set; }
    public required string Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public Account Account { get; set; } = null!;
    public Team? Team { get; set; }
}
