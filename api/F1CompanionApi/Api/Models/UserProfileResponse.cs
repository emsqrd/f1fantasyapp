namespace F1CompanionApi.Api.Models;

public class UserProfileResponse
{
    public required int Id { get; set; }
    public required string Email { get; set; }
    public string? DisplayName { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public TeamResponse? Team { get; set; }
}
