using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.UnitTests.Api.Mappers;

public class UserProfileResponseMapperTests
{
    [Fact]
    public void ToResponseModel_CopiesScalarFields()
    {
        var createdAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var updatedAt = new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc);
        var profile = new UserProfile
        {
            Id = 7,
            AccountId = "account-7",
            Email = "ada@example.com",
            DisplayName = "Ada",
            FirstName = "Ada",
            LastName = "Lovelace",
            AvatarUrl = "https://example.com/ada.png",
            CreatedAt = createdAt,
            UpdatedAt = updatedAt,
        };

        var response = profile.ToResponseModel();

        Assert.Equal(7, response.Id);
        Assert.Equal("ada@example.com", response.Email);
        Assert.Equal("Ada", response.DisplayName);
        Assert.Equal("Ada", response.FirstName);
        Assert.Equal("Lovelace", response.LastName);
        Assert.Equal("https://example.com/ada.png", response.AvatarUrl);
        Assert.Equal(createdAt, response.CreatedAt);
        Assert.Equal(updatedAt, response.UpdatedAt);
    }

    [Fact]
    public void ToResponseModel_NoTeam_HasTeamFalse()
    {
        var profile = new UserProfile { AccountId = "account-1", Email = "user@example.com" };

        var response = profile.ToResponseModel();

        Assert.False(response.HasTeam);
    }

    [Fact]
    public void ToResponseModel_WithTeam_HasTeamTrue()
    {
        var profile = new UserProfile
        {
            AccountId = "account-1",
            Email = "user@example.com",
            Team = new Team { Name = "Test Team" },
        };

        var response = profile.ToResponseModel();

        Assert.True(response.HasTeam);
    }
}
