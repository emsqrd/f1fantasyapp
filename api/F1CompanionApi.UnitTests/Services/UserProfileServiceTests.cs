using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class UserProfileServiceTests
{
    private const string TestAccountId = "test-account-123";
    private const string TestEmail = "test@example.com";
    private const string TestDisplayName = "Test User";
    private readonly Mock<ILogger<UserProfileService>> _mockLogger;

    public UserProfileServiceTests()
    {
        _mockLogger = new Mock<ILogger<UserProfileService>>();
    }

    private static ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public void Constructor_NullDbContext_ThrowsArgumentNullException()
    {
        // Arrange
        var authService = new Mock<ISupabaseAuthService>();

        // Act & Assert
        Assert.Throws<ArgumentNullException>(
            () => new UserProfileService(null!, authService.Object, _mockLogger.Object)
        );
    }

    [Fact]
    public void Constructor_NullAuthService_ThrowsArgumentNullException()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        // Act & Assert
        Assert.Throws<ArgumentNullException>(
            () => new UserProfileService(context, null!, _mockLogger.Object)
        );
    }

    [Fact]
    public async Task GetUserProfileByAccountIdAsync_UserExists_ReturnsUserProfile()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = TestDisplayName,
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetUserProfileByAccountIdAsync(TestAccountId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userProfile.Id, result.Id);
        Assert.Equal(TestEmail, result.Email);
        Assert.Equal(TestDisplayName, result.DisplayName);
    }

    [Fact]
    public async Task GetUserProfileByAccountIdAsync_UserDoesNotExist_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Act
        var result = await service.GetUserProfileByAccountIdAsync("non-existent-account");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetCurrentUserProfileAsync_UserIdExists_ReturnsUserProfile()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        authService.Setup(x => x.GetUserId()).Returns(TestAccountId);

        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = TestDisplayName,
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetCurrentUserProfileAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userProfile.Id, result.Id);
        authService.Verify(x => x.GetUserId(), Times.Once);
    }

    [Fact]
    public async Task GetCurrentUserProfileAsync_NoUserId_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        authService.Setup(x => x.GetUserId()).Returns((string?)null);

        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Act
        var result = await service.GetCurrentUserProfileAsync();

        // Assert
        Assert.Null(result);
        authService.Verify(x => x.GetUserId(), Times.Once);
    }

    [Fact]
    public async Task GetRequiredCurrentUserProfileAsync_UserExists_ReturnsUserProfile()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        authService.Setup(x => x.GetRequiredUserId()).Returns(TestAccountId);

        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = TestDisplayName,
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetRequiredCurrentUserProfileAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(userProfile.Id, result.Id);
        authService.Verify(x => x.GetRequiredUserId(), Times.Once);
    }

    [Fact]
    public async Task GetRequiredCurrentUserProfileAsync_UserDoesNotExist_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        authService.Setup(x => x.GetRequiredUserId()).Returns(TestAccountId);

        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UserProfileNotFoundException>(
            () => service.GetRequiredCurrentUserProfileAsync()
        );
        Assert.Contains(TestAccountId, exception.Message);
    }

    [Fact]
    public async Task CreateUserProfileAsync_ValidData_CreatesAccountAndProfile()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Act
        var result = await service.CreateUserProfileAsync(
            TestAccountId,
            TestEmail,
            TestDisplayName
        );

        // Assert
        Assert.NotNull(result);
        Assert.Equal(TestEmail, result.Email);
        Assert.Equal(TestDisplayName, result.DisplayName);

        var savedAccount = await context.Accounts.FindAsync(TestAccountId);
        Assert.NotNull(savedAccount);
        Assert.True(savedAccount.IsActive);

        var savedProfile = await context.UserProfiles.FirstOrDefaultAsync(
            x => x.AccountId == TestAccountId
        );
        Assert.NotNull(savedProfile);
        Assert.Equal(TestEmail, savedProfile.Email);
        Assert.NotEqual(default, savedProfile.CreatedAt);
    }

    [Fact]
    public async Task CreateUserProfileAsync_WithoutDisplayName_CreatesProfileWithNullDisplayName()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Act
        var result = await service.CreateUserProfileAsync(TestAccountId, TestEmail);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(TestEmail, result.Email);
        Assert.Null(result.DisplayName);
    }

    [Fact]
    public async Task CreateUserProfileAsync_DatabaseError_RollsBackTransaction()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        // Create an account first to cause a duplicate key error
        var existingAccount = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };
        context.Accounts.Add(existingAccount);
        await context.SaveChangesAsync();

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.CreateUserProfileAsync(TestAccountId, TestEmail, TestDisplayName)
        );

        // Verify rollback - no profile should be created
        var profileCount = await context.UserProfiles.CountAsync(
            x => x.AccountId == TestAccountId
        );
        Assert.Equal(0, profileCount);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_AllFields_UpdatesAllProperties()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = "Old Name",
            FirstName = "Old",
            LastName = "User",
            AvatarUrl = "old-url.jpg",
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        var updateRequest = new UpdateUserProfileRequest
        {
            Id = userProfile.Id,
            DisplayName = "New Name",
            Email = "new@example.com",
            FirstName = "New",
            LastName = "Person",
            AvatarUrl = "new-url.jpg"
        };

        // Act
        var result = await service.UpdateUserProfileAsync(updateRequest);

        // Assert
        Assert.Equal("New Name", result.DisplayName);
        Assert.Equal("new@example.com", result.Email);
        Assert.Equal("New", result.FirstName);
        Assert.Equal("Person", result.LastName);
        Assert.Equal("new-url.jpg", result.AvatarUrl);

        var updatedProfile = await context.UserProfiles.FindAsync(userProfile.Id);
        Assert.Equal("New Name", updatedProfile!.DisplayName);
        Assert.Equal("new@example.com", updatedProfile.Email);
        Assert.NotNull(updatedProfile.UpdatedAt);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_PartialUpdate_UpdatesOnlyProvidedFields()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = "Original Name",
            FirstName = "Original",
            LastName = "User",
            AvatarUrl = "original-url.jpg",
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        var updateRequest = new UpdateUserProfileRequest
        {
            Id = userProfile.Id,
            FirstName = "Updated"
            // Other fields are null, should not update
        };

        // Act
        var result = await service.UpdateUserProfileAsync(updateRequest);

        // Assert
        Assert.Equal("Updated", result.FirstName);
        Assert.Equal("Original Name", result.DisplayName);
        Assert.Equal(TestEmail, result.Email);
        Assert.Equal("User", result.LastName);
        Assert.Equal("original-url.jpg", result.AvatarUrl);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_NonExistentUser_ThrowsKeyNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var updateRequest = new UpdateUserProfileRequest
        {
            Id = 999,
            DisplayName = "New Name"
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.UpdateUserProfileAsync(updateRequest)
        );
        Assert.Contains("User with ID 999 not found", exception.Message);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_NullValues_DoesNotOverwriteExistingData()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var authService = new Mock<ISupabaseAuthService>();
        var service = new UserProfileService(context, authService.Object, _mockLogger.Object);

        var account = new Account
        {
            Id = TestAccountId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            IsActive = true
        };

        var userProfile = new UserProfile
        {
            AccountId = TestAccountId,
            Email = TestEmail,
            DisplayName = "Existing Name",
            FirstName = "Existing",
            LastName = "User",
            AvatarUrl = "existing-url.jpg",
            CreatedAt = DateTime.UtcNow,
            Account = account
        };

        context.Accounts.Add(account);
        context.UserProfiles.Add(userProfile);
        await context.SaveChangesAsync();

        var updateRequest = new UpdateUserProfileRequest
        {
            Id = userProfile.Id
            // All fields are null
        };

        // Act
        var result = await service.UpdateUserProfileAsync(updateRequest);

        // Assert - all original values should be preserved
        Assert.Equal("Existing Name", result.DisplayName);
        Assert.Equal(TestEmail, result.Email);
        Assert.Equal("Existing", result.FirstName);
        Assert.Equal("User", result.LastName);
        Assert.Equal("existing-url.jpg", result.AvatarUrl);
    }
}
