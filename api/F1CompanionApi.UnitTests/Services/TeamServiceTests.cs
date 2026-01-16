using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class TeamServiceTests
{
    private readonly Mock<ILogger<TeamService>> _mockLogger;

    public TeamServiceTests()
    {
        _mockLogger = new Mock<ILogger<TeamService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CreateTeamAsync_ValidRequest_ReturnsTeamResponseWithCorrectData()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest
        {
            Name = "Test Team"
        };

        // Act
        var result = await service.CreateTeamAsync(request, user.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Test Team", result.Name);
        Assert.Equal("John Doe", result.OwnerName);
    }

    [Fact]
    public async Task CreateTeamAsync_ValidRequest_PersistsTeamToDatabase()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "Jane",
            LastName = "Smith"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest
        {
            Name = "Persistent Team"
        };

        // Act
        await service.CreateTeamAsync(request, user.Id);

        // Assert
        var savedTeam = await context.Teams.FirstOrDefaultAsync();
        Assert.NotNull(savedTeam);
        Assert.Equal("Persistent Team", savedTeam.Name);
        Assert.Equal(user.Id, savedTeam.UserId);
        Assert.Equal(user.Id, savedTeam.CreatedBy);
    }

    [Fact]
    public async Task CreateTeamAsync_UserAlreadyHasTeam_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var existingTeam = new Team
        {
            Name = "Existing Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(existingTeam);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest
        {
            Name = "New Team"
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<DuplicateTeamException>(
            () => service.CreateTeamAsync(request, user.Id)
        );
        Assert.Contains(user.Id.ToString(), exception.Message);
        Assert.Contains(existingTeam.Id.ToString(), exception.Message);
    }

    [Fact]
    public async Task CreateTeamAsync_NonExistentUser_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var request = new CreateTeamRequest
        {
            Name = "Test Team"
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UserProfileNotFoundException>(
            () => service.CreateTeamAsync(request, 999)
        );
        Assert.Contains("999", exception.Message);
    }

    [Theory]
    [InlineData("  Team With Spaces  ", "Team With Spaces")]
    [InlineData("   Leading Spaces", "Leading Spaces")]
    [InlineData("Trailing Spaces   ", "Trailing Spaces")]
    public async Task CreateTeamAsync_TeamNameWithWhitespace_TrimsWhitespace(
        string inputName,
        string expectedName
    )
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest
        {
            Name = inputName
        };

        // Act
        var result = await service.CreateTeamAsync(request, user.Id);

        // Assert
        Assert.Equal(expectedName, result.Name);

        var savedTeam = await context.Teams.FirstOrDefaultAsync();
        Assert.NotNull(savedTeam);
        Assert.Equal(expectedName, savedTeam.Name);
    }

    [Fact]
    public async Task GetUserTeamAsync_UserHasTeam_ReturnsTeamResponse()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var team = new Team
        {
            Name = "Findable Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(team);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetUserTeamAsync(user.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(team.Id, result.Id);
        Assert.Equal("Findable Team", result.Name);
        Assert.Equal("John Doe", result.OwnerName);
    }

    [Fact]
    public async Task GetUserTeamAsync_UserHasNoTeam_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetUserTeamAsync(user.Id);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetUserTeamAsync_NonExistentUser_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        // Act
        var result = await service.GetUserTeamAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task CreateTeamAsync_ConcurrentRequests_OnlyFirstSucceeds()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request1 = new CreateTeamRequest { Name = "Team 1" };
        var request2 = new CreateTeamRequest { Name = "Team 2" };

        // Act - first request succeeds
        var result = await service.CreateTeamAsync(request1, user.Id);

        // Act & Assert - second request fails
        var exception = await Assert.ThrowsAsync<DuplicateTeamException>(
            () => service.CreateTeamAsync(request2, user.Id)
        );

        Assert.Equal(user.Id, exception.UserId);
        Assert.Equal("Team 1", result.Name);

        // Verify only one team exists
        var teamCount = await context.Teams.CountAsync(t => t.UserId == user.Id);
        Assert.Equal(1, teamCount);
    }

    #region AddDriverToTeamAsync Tests

    [Fact]
    public async Task AddDriverToTeamAsync_ValidRequest_AddsDriverToTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers
            .FirstOrDefaultAsync(td => td.TeamId == team.Id && td.DriverId == driver.Id);

        Assert.NotNull(teamDriver);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.AddDriverToTeamAsync(999, driver.Id, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(
            () => service.AddDriverToTeamAsync(team.Id, driver.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(5)]
    [InlineData(10)]
    public async Task AddDriverToTeamAsync_InvalidSlotPosition_ThrowsInvalidOperationException(int slotPosition)
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidSlotPositionException>(
            () => service.AddDriverToTeamAsync(team.Id, driver.Id, slotPosition, user.Id)
        );
        Assert.Equal(slotPosition, exception.Position);
        Assert.Contains("drivers", exception.Message);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_TeamHasMaximumDrivers_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Add 5 drivers to fill all slots
        for (int i = 0; i < 5; i++)
        {
            var driver = CreateTestDriver(context, $"DR{i}", $"Driver{i}", $"Last{i}");
            await service.AddDriverToTeamAsync(team.Id, driver.Id, i, user.Id);
        }

        var newDriver = CreateTestDriver(context, "NEW", "New", "Driver");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamFullException>(
            () => service.AddDriverToTeamAsync(team.Id, newDriver.Id, 0, user.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(5, exception.MaxSlots);
        Assert.Equal("driver", exception.EntityType);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_SlotAlreadyOccupied_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver1 = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var driver2 = CreateTestDriver(context, "PER", "Sergio", "Perez");

        await service.AddDriverToTeamAsync(team.Id, driver1.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<SlotOccupiedException>(
            () => service.AddDriverToTeamAsync(team.Id, driver2.Id, 0, user.Id)
        );
        Assert.Equal(0, exception.Position);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_DriverAlreadyOnTeam_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityAlreadyOnTeamException>(
            () => service.AddDriverToTeamAsync(team.Id, driver.Id, 1, user.Id)
        );
        Assert.Equal(driver.Id, exception.EntityId);
        Assert.Equal("driver", exception.EntityType);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_DriverNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.AddDriverToTeamAsync(team.Id, 999, 0, user.Id)
        );
        Assert.Equal("Driver not found", exception.Message);
    }

    #endregion

    #region RemoveDriverFromTeamAsync Tests

    [Fact]
    public async Task RemoveDriverFromTeamAsync_ValidRequest_RemovesDriverFromTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act
        await service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers
            .FirstOrDefaultAsync(td => td.TeamId == team.Id && td.SlotPosition == 0);

        Assert.Null(teamDriver);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RemoveDriverFromTeamAsync(999, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, owner.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(
            () => service.RemoveDriverFromTeamAsync(team.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_EmptySlot_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id)
        );
        Assert.Equal("No driver found at slot position 0", exception.Message);
    }

    #endregion

    #region AddConstructorToTeamAsync Tests

    [Fact]
    public async Task AddConstructorToTeamAsync_ValidRequest_AddsConstructorToTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Assert
        var teamConstructor = await context.TeamConstructors
            .FirstOrDefaultAsync(tc => tc.TeamId == team.Id && tc.ConstructorId == constructor.Id);

        Assert.NotNull(teamConstructor);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.AddConstructorToTeamAsync(999, constructor.Id, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(
            () => service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    [InlineData(5)]
    public async Task AddConstructorToTeamAsync_InvalidSlotPosition_ThrowsInvalidOperationException(int slotPosition)
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidSlotPositionException>(
            () => service.AddConstructorToTeamAsync(team.Id, constructor.Id, slotPosition, user.Id)
        );
        Assert.Equal(slotPosition, exception.Position);
        Assert.Contains("constructors", exception.Message);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TeamHasMaximumConstructors_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Add 2 constructors to fill all slots
        var constructor1 = CreateTestConstructor(context, "Red Bull Racing");
        var constructor2 = CreateTestConstructor(context, "Ferrari");
        await service.AddConstructorToTeamAsync(team.Id, constructor1.Id, 0, user.Id);
        await service.AddConstructorToTeamAsync(team.Id, constructor2.Id, 1, user.Id);

        var newConstructor = CreateTestConstructor(context, "Mercedes");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamFullException>(
            () => service.AddConstructorToTeamAsync(team.Id, newConstructor.Id, 0, user.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(2, exception.MaxSlots);
        Assert.Equal("constructor", exception.EntityType);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_SlotAlreadyOccupied_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor1 = CreateTestConstructor(context, "Red Bull Racing");
        var constructor2 = CreateTestConstructor(context, "Ferrari");

        await service.AddConstructorToTeamAsync(team.Id, constructor1.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<SlotOccupiedException>(
            () => service.AddConstructorToTeamAsync(team.Id, constructor2.Id, 0, user.Id)
        );
        Assert.Equal(0, exception.Position);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_ConstructorAlreadyOnTeam_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityAlreadyOnTeamException>(
            () => service.AddConstructorToTeamAsync(team.Id, constructor.Id, 1, user.Id)
        );
        Assert.Equal(constructor.Id, exception.EntityId);
        Assert.Equal("constructor", exception.EntityType);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_ConstructorNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.AddConstructorToTeamAsync(team.Id, 999, 0, user.Id)
        );
        Assert.Equal("Constructor not found", exception.Message);
    }

    #endregion

    #region RemoveConstructorFromTeamAsync Tests

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_ValidRequest_RemovesConstructorFromTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Act
        await service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        var teamConstructor = await context.TeamConstructors
            .FirstOrDefaultAsync(tc => tc.TeamId == team.Id && tc.SlotPosition == 0);

        Assert.Null(teamConstructor);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RemoveConstructorFromTeamAsync(999, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, owner.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(
            () => service.RemoveConstructorFromTeamAsync(team.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_EmptySlot_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new TeamService(context, _mockLogger.Object);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id)
        );
        Assert.Equal("No constructor found at slot position 0", exception.Message);
    }

    #endregion

    #region Helper Methods

    private UserProfile CreateTestUser(ApplicationDbContext context, string email = "user@test.com")
    {
        var user = new UserProfile
        {
            AccountId = Guid.NewGuid().ToString(),
            Email = email,
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(user);
        context.SaveChanges();
        return user;
    }

    private Team CreateTestTeam(ApplicationDbContext context, int userId, string name = "Test Team")
    {
        var team = new Team
        {
            Name = name,
            UserId = userId,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(team);
        context.SaveChanges();
        return team;
    }

    private Driver CreateTestDriver(ApplicationDbContext context, string abbreviation, string firstName, string lastName)
    {
        var driver = new Driver
        {
            FirstName = firstName,
            LastName = lastName,
            Abbreviation = abbreviation,
            CountryAbbreviation = "NL",
            IsActive = true
        };
        context.Drivers.Add(driver);
        context.SaveChanges();
        return driver;
    }

    private Constructor CreateTestConstructor(ApplicationDbContext context, string name)
    {
        var constructor = new Constructor
        {
            Name = name,
            CountryAbbreviation = "AT",
            IsActive = true
        };
        context.Constructors.Add(constructor);
        context.SaveChanges();
        return constructor;
    }

    #endregion
}
