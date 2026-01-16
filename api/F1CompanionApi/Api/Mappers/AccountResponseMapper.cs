using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.Api.Mappers;

public static class AccountResponseMapper
{
    public static AccountResponse ToResponseModel(this Account account)
    {
        return new AccountResponse
        {
            Id = account.Id,
            CreatedAt = account.CreatedAt,
            UpdatedAt = account.UpdatedAt,
            DeletedAt = account.DeletedAt,
            IsDeleted = account.IsDeleted,
            IsActive = account.IsActive,
            LastLoginAt = account.LastLoginAt
        };
    }
}
