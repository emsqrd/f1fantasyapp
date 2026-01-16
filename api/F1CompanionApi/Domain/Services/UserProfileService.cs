using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace F1CompanionApi.Domain.Services;

public interface IUserProfileService
{
    Task<UserProfileResponse?> GetUserProfileByAccountIdAsync(string accountId);
    Task<UserProfileResponse?> GetCurrentUserProfileAsync();
    Task<UserProfileResponse> GetRequiredCurrentUserProfileAsync();
    Task<UserProfileResponse> CreateUserProfileAsync(
        string accountId,
        string email,
        string? displayName = null
    );
    Task<UserProfileResponse> UpdateUserProfileAsync(
        UpdateUserProfileRequest updateUserProfileRequest
    );
}

public class UserProfileService : IUserProfileService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ISupabaseAuthService _authService;
    private readonly ILogger<UserProfileService> _logger;

    public UserProfileService(
        ApplicationDbContext dbContext,
        ISupabaseAuthService authService,
        ILogger<UserProfileService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(authService);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _authService = authService;
        _logger = logger;
    }

    public async Task<UserProfileResponse?> GetUserProfileByAccountIdAsync(string accountId)
    {
        _logger.LogDebug("Fetching user profile for account {AccountId}", accountId);
        var profile = await _dbContext
            .UserProfiles
                .Include(x => x.Account)
                .Include(x => x.Team)
            .FirstOrDefaultAsync(x => x.AccountId == accountId);

        if (profile is null)
        {
            _logger.LogDebug("User profile not found for account {AccountId}", accountId);
            return null;
        }

        return profile.ToResponseModel();
    }

    public async Task<UserProfileResponse?> GetCurrentUserProfileAsync()
    {
        var userId = _authService.GetUserId();
        if (userId is null)
        {
            _logger.LogWarning("No authenticated user ID found when fetching current user profile");
            return null;
        }

        return await GetUserProfileByAccountIdAsync(userId);
    }

    public async Task<UserProfileResponse> GetRequiredCurrentUserProfileAsync()
    {
        var userId = _authService.GetRequiredUserId();
        var profile = await GetUserProfileByAccountIdAsync(userId);

        if (profile is null)
        {
            _logger.LogError("User profile not found for authenticated user {UserId}", userId);
            throw new UserProfileNotFoundException(userId);
        }

        return profile;
    }

    public async Task<UserProfileResponse> CreateUserProfileAsync(
        string accountId,
        string email,
        string? displayName = null
    )
    {
        _logger.LogInformation("Creating user profile for account {AccountId} with email {Email}",
            accountId, email);

        using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            // Create Account
            var account = new Account
            {
                Id = accountId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
                IsActive = true,
                LastLoginAt = DateTime.UtcNow,
            };

            _dbContext.Accounts.Add(account);

            // Create UserProfile
            var userProfile = new UserProfile
            {
                AccountId = accountId,
                Email = email,
                DisplayName = displayName,
                CreatedAt = DateTime.UtcNow,
            };

            _dbContext.UserProfiles.Add(userProfile);

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Successfully created user profile {ProfileId} for account {AccountId}",
                userProfile.Id, accountId);

            return userProfile.ToResponseModel();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create user profile for account {AccountId}. Transaction rolled back.",
                accountId);
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<UserProfileResponse> UpdateUserProfileAsync(
        UpdateUserProfileRequest updateUserProfileRequest
    )
    {
        _logger.LogDebug("Updating user profile {ProfileId}", updateUserProfileRequest.Id);

        var existingUserProfile = await _dbContext.UserProfiles
            .Include(x => x.Team)
            .FirstOrDefaultAsync(x => x.Id == updateUserProfileRequest.Id);

        if (existingUserProfile is null)
        {
            _logger.LogError("User profile {ProfileId} not found when attempting update",
                updateUserProfileRequest.Id);
            throw new KeyNotFoundException($"User with ID {updateUserProfileRequest.Id} not found");
        }

        if (updateUserProfileRequest.DisplayName is not null)
            existingUserProfile.DisplayName = updateUserProfileRequest.DisplayName;

        if (updateUserProfileRequest.Email is not null)
            existingUserProfile.Email = updateUserProfileRequest.Email;

        if (updateUserProfileRequest.FirstName is not null)
            existingUserProfile.FirstName = updateUserProfileRequest.FirstName;

        if (updateUserProfileRequest.LastName is not null)
            existingUserProfile.LastName = updateUserProfileRequest.LastName;

        if (updateUserProfileRequest.AvatarUrl is not null)
            existingUserProfile.AvatarUrl = updateUserProfileRequest.AvatarUrl;

        existingUserProfile.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Successfully updated user profile {ProfileId}", existingUserProfile.Id);

        return existingUserProfile.ToResponseModel();
    }
}
