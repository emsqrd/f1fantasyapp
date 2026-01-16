using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class UserProfileResponseMapper
{
    public static UserProfileResponse ToResponseModel(this UserProfile userProfile)
    {
        return new UserProfileResponse
        {
            Id = userProfile.Id,
            Email = userProfile.Email,
            DisplayName = userProfile.DisplayName,
            FirstName = userProfile.FirstName,
            LastName = userProfile.LastName,
            AvatarUrl = userProfile.AvatarUrl,
            CreatedAt = userProfile.CreatedAt,
            UpdatedAt = userProfile.UpdatedAt,
            Team = userProfile.Team?.ToResponseModel()
        };
    }
}
