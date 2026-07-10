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

    private TeamService CreateService(ApplicationDbContext context)
    {
        var raceWeekendService = new Mock<IRaceWeekendService>();
        raceWeekendService
            .Setup(s => s.GetCurrentSeasonRaceWeekendAsync())
            .Returns(() =>
                context
                    .RaceWeekends.Where(r => r.ScoredAt == null)
                    .OrderBy(r => r.Round)
                    .FirstOrDefaultAsync()
            );

        var seasonService = new Mock<ISeasonService>();

        return new TeamService(
            context,
            raceWeekendService.Object,
            seasonService.Object,
            _mockLogger.Object
        );
    }

    [Fact]
    public async Task CreateTeamAsync_ValidRequest_ReturnsTeamResponseWithCorrectData()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest { Name = "Test Team" };

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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "Jane",
            LastName = "Smith",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest { Name = "Persistent Team" };

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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var existingTeam = new Team
        {
            Name = "Existing Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow,
        };
        context.Teams.Add(existingTeam);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest { Name = "New Team" };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<DuplicateTeamException>(() =>
            service.CreateTeamAsync(request, user.Id)
        );
        Assert.Contains(user.Id.ToString(), exception.Message);
        Assert.Contains(existingTeam.Id.ToString(), exception.Message);
    }

    [Fact]
    public async Task CreateTeamAsync_NonExistentUser_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var request = new CreateTeamRequest { Name = "Test Team" };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UserProfileNotFoundException>(() =>
            service.CreateTeamAsync(request, 999)
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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request = new CreateTeamRequest { Name = inputName };

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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var team = new Team
        {
            Name = "Findable Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow,
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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
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
        var service = CreateService(context);

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
        var service = CreateService(context);

        var user = new UserProfile
        {
            AccountId = "test-account",
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var request1 = new CreateTeamRequest { Name = "Team 1" };
        var request2 = new CreateTeamRequest { Name = "Team 2" };

        // Act - first request succeeds
        var result = await service.CreateTeamAsync(request1, user.Id);

        // Act & Assert - second request fails
        var exception = await Assert.ThrowsAsync<DuplicateTeamException>(() =>
            service.CreateTeamAsync(request2, user.Id)
        );

        Assert.Equal(user.Id, exception.UserId);
        Assert.Equal("Team 1", result.Name);

        // Verify only one team exists
        var teamCount = await context.Teams.CountAsync(t => t.UserId == user.Id);
        Assert.Equal(1, teamCount);
    }

    #region Lineup Lock Tests

    [Fact]
    public async Task AddDriverToTeamAsync_WhenLineupLocked_ThrowsLineupLockedException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(-1)
        );

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LineupLockedException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id)
        );
        Assert.Equal("Test Grand Prix", exception.RaceName);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_WhenLockDeadlineNotPassed_Succeeds()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.DriverId == driver.Id
        );
        Assert.NotNull(teamDriver);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_WhenNoLockDeadlineSet_Succeeds()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(context, raceDate: DateTime.UtcNow.AddDays(2), lockDeadline: null);

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.DriverId == driver.Id
        );
        Assert.NotNull(teamDriver);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_WhenLineupLocked_ThrowsLineupLockedException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(-1)
        );

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LineupLockedException>(() =>
            service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id)
        );
        Assert.Equal("Test Grand Prix", exception.RaceName);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_WhenLineupLocked_ThrowsLineupLockedException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(-1)
        );

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LineupLockedException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id)
        );
        Assert.Equal("Test Grand Prix", exception.RaceName);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_WhenLineupLocked_ThrowsLineupLockedException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(-1)
        );

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LineupLockedException>(() =>
            service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id)
        );
        Assert.Equal("Test Grand Prix", exception.RaceName);
    }

    #endregion

    #region AddDriverToTeamAsync Tests

    [Fact]
    public async Task AddDriverToTeamAsync_ValidRequest_AddsDriverToTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.DriverId == driver.Id
        );

        Assert.NotNull(teamDriver);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AddDriverToTeamAsync(999, driver.Id, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(6)]
    public async Task AddDriverToTeamAsync_InvalidSlotPosition_ThrowsInvalidOperationException(
        int slotPosition
    )
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidSlotPositionException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver.Id, slotPosition, user.Id)
        );
        Assert.Equal(slotPosition, exception.Position);
        Assert.Contains("drivers", exception.Message);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_TeamHasMaximumDrivers_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

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
        var exception = await Assert.ThrowsAsync<TeamFullException>(() =>
            service.AddDriverToTeamAsync(team.Id, newDriver.Id, 0, user.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver1 = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var driver2 = CreateTestDriver(context, "PER", "Sergio", "Perez");

        await service.AddDriverToTeamAsync(team.Id, driver1.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<SlotOccupiedException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver2.Id, 0, user.Id)
        );
        Assert.Equal(0, exception.Position);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_DriverAlreadyOnTeam_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityAlreadyOnTeamException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver.Id, 1, user.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AddDriverToTeamAsync(team.Id, 999, 0, user.Id)
        );
        Assert.Equal("Driver not found", exception.Message);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_PlayerFitsWithinBudget_Succeeds()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "NOR", "Lando", "Norris", price: 50_000_000m);

        // Act — 50M < 100M cap, should succeed
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.DriverId == driver.Id
        );
        Assert.NotNull(teamDriver);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "NOR", "Lando", "Norris", price: 101_000_000m);

        // Act & Assert — 101M > 100M cap
        var exception = await Assert.ThrowsAsync<BudgetExceededException>(() =>
            service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(101_000_000m, exception.PlayerPrice);
        Assert.Equal(100_000_000m, exception.RemainingBudget);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_ExactlyAtBudgetCap_Succeeds()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "NOR", "Lando", "Norris", price: 100_000_000m);

        // Act — exactly at cap, should succeed
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.DriverId == driver.Id
        );
        Assert.NotNull(teamDriver);
    }

    #endregion

    #region RemoveDriverFromTeamAsync Tests

    [Fact]
    public async Task RemoveDriverFromTeamAsync_ValidRequest_RemovesDriverFromTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act
        await service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        var teamDriver = await context.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == team.Id && td.SlotPosition == 0
        );

        Assert.Null(teamDriver);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RemoveDriverFromTeamAsync(999, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, owner.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(() =>
            service.RemoveDriverFromTeamAsync(team.Id, 0, otherUser.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Assert
        var teamConstructor = await context.TeamConstructors.FirstOrDefaultAsync(tc =>
            tc.TeamId == team.Id && tc.ConstructorId == constructor.Id
        );

        Assert.NotNull(teamConstructor);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AddConstructorToTeamAsync(999, constructor.Id, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, otherUser.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(owner.Id, exception.OwnerId);
        Assert.Equal(otherUser.Id, exception.AttemptedUserId);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    public async Task AddConstructorToTeamAsync_InvalidSlotPosition_ThrowsInvalidOperationException(
        int slotPosition
    )
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidSlotPositionException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, slotPosition, user.Id)
        );
        Assert.Equal(slotPosition, exception.Position);
        Assert.Contains("constructors", exception.Message);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TeamHasMaximumConstructors_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Add 2 constructors to fill all slots
        for (int i = 0; i < 2; i++)
        {
            var constructor = CreateTestConstructor(context, $"Constructor{i}");
            await service.AddConstructorToTeamAsync(team.Id, constructor.Id, i, user.Id);
        }

        var newConstructor = CreateTestConstructor(context, "Mercedes");

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamFullException>(() =>
            service.AddConstructorToTeamAsync(team.Id, newConstructor.Id, 0, user.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor1 = CreateTestConstructor(context, "Red Bull Racing");
        var constructor2 = CreateTestConstructor(context, "Ferrari");

        await service.AddConstructorToTeamAsync(team.Id, constructor1.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<SlotOccupiedException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor2.Id, 0, user.Id)
        );
        Assert.Equal(0, exception.Position);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_SameConstructorSecondAdd_ThrowsEntityAlreadyOnTeamException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<EntityAlreadyOnTeamException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, 1, user.Id)
        );
        Assert.Equal(constructor.Id, exception.EntityId);
        Assert.Equal("constructor", exception.EntityType);
        Assert.Equal(team.Id, exception.TeamId);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TwoDifferentConstructors_FillsAllSlots()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor1 = CreateTestConstructor(context, "Red Bull Racing");
        var constructor2 = CreateTestConstructor(context, "Ferrari");

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor1.Id, 0, user.Id);
        await service.AddConstructorToTeamAsync(team.Id, constructor2.Id, 1, user.Id);

        // Assert
        var teamConstructors = context.TeamConstructors.Where(tc => tc.TeamId == team.Id).ToList();
        Assert.Equal(2, teamConstructors.Count);
        Assert.Equal(1, teamConstructors.Count(tc => tc.ConstructorId == constructor1.Id));
        Assert.Equal(1, teamConstructors.Count(tc => tc.ConstructorId == constructor2.Id));
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_ConstructorNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.AddConstructorToTeamAsync(team.Id, 999, 0, user.Id)
        );
        Assert.Equal("Constructor not found", exception.Message);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_PlayerExceedsBudget_ThrowsBudgetExceededException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing", price: 101_000_000m);

        // Act & Assert — 101M > 100M cap
        var exception = await Assert.ThrowsAsync<BudgetExceededException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(101_000_000m, exception.PlayerPrice);
        Assert.Equal(100_000_000m, exception.RemainingBudget);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_CumulativeCostExceedsBudget_ThrowsBudgetExceededException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Add a driver costing 60M first
        var driver = CreateTestDriver(context, "NOR", "Lando", "Norris", price: 60_000_000m);
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Now try to add a constructor costing 50M — 60M + 50M = 110M > 100M cap
        var constructor = CreateTestConstructor(context, "Red Bull Racing", price: 50_000_000m);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<BudgetExceededException>(() =>
            service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id)
        );
        Assert.Equal(team.Id, exception.TeamId);
        Assert.Equal(50_000_000m, exception.PlayerPrice);
        Assert.Equal(40_000_000m, exception.RemainingBudget); // 100M - 60M = 40M remaining
    }

    #endregion

    #region RemoveConstructorFromTeamAsync Tests

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_ValidRequest_RemovesConstructorFromTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Act
        await service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        var teamConstructor = await context.TeamConstructors.FirstOrDefaultAsync(tc =>
            tc.TeamId == team.Id && tc.SlotPosition == 0
        );

        Assert.Null(teamConstructor);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_TeamNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RemoveConstructorFromTeamAsync(999, 0, 1)
        );
        Assert.Equal("Team not found", exception.Message);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_NonOwnerAttempt_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var owner = CreateTestUser(context);
        var otherUser = CreateTestUser(context, "other@test.com");
        var team = CreateTestTeam(context, owner.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, owner.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamOwnershipException>(() =>
            service.RemoveConstructorFromTeamAsync(team.Id, 0, otherUser.Id)
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
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id)
        );
        Assert.Equal("No constructor found at slot position 0", exception.Message);
    }

    #endregion

    #region Lineup Snapshot Tests

    [Fact]
    public async Task AddDriverToTeamAsync_WithUpcomingRace_CreatesLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var entry = await context.LineupEntries.FirstOrDefaultAsync();
        Assert.NotNull(entry);
        Assert.Equal(team.Id, entry.TeamId);
        Assert.Equal(race.Id, entry.RaceWeekendId);
        Assert.Equal(driver.Id, entry.EntityId);
        Assert.Equal(LineupEntityType.Driver, entry.EntityType);
        Assert.Equal(0, entry.SlotPosition);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_WithNoUpcomingRace_DoesNotCreateLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        Assert.NotNull(await context.TeamDrivers.FirstOrDefaultAsync());
        Assert.Equal(0, await context.LineupEntries.CountAsync());
    }

    [Fact]
    public async Task AddDriverToTeamAsync_RaceHasNoLockDeadline_CreatesLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: null
        );

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        var entry = await context.LineupEntries.FirstOrDefaultAsync();
        Assert.NotNull(entry);
        Assert.Equal(race.Id, entry.RaceWeekendId);
        Assert.Equal(LineupEntityType.Driver, entry.EntityType);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_WithUpcomingRace_DeletesLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act
        await service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        Assert.Null(await context.LineupEntries.FirstOrDefaultAsync());
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_NoSnapshotExists_StillRemovesDriver()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Add driver directly — no snapshot written
        context.TeamDrivers.Add(
            new TeamDriver
            {
                TeamId = team.Id,
                DriverId = driver.Id,
                SlotPosition = 0,
                CreatedBy = user.Id,
                CreatedAt = DateTime.UtcNow,
            }
        );
        await context.SaveChangesAsync();

        // Act — should not throw even though no lineup entry exists
        await service.RemoveDriverFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        Assert.Null(await context.TeamDrivers.FirstOrDefaultAsync());
        Assert.Equal(0, await context.LineupEntries.CountAsync());
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_WithUpcomingRace_CreatesLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Assert
        var entry = await context.LineupEntries.FirstOrDefaultAsync();
        Assert.NotNull(entry);
        Assert.Equal(team.Id, entry.TeamId);
        Assert.Equal(race.Id, entry.RaceWeekendId);
        Assert.Equal(constructor.Id, entry.EntityId);
        Assert.Equal(LineupEntityType.Constructor, entry.EntityType);
        Assert.Equal(0, entry.SlotPosition);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_WithNoUpcomingRace_DoesNotCreateLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Assert
        Assert.NotNull(await context.TeamConstructors.FirstOrDefaultAsync());
        Assert.Equal(0, await context.LineupEntries.CountAsync());
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_WithUpcomingRace_DeletesLineupEntry()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor = CreateTestConstructor(context, "Red Bull Racing");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        await service.AddConstructorToTeamAsync(team.Id, constructor.Id, 0, user.Id);

        // Act
        await service.RemoveConstructorFromTeamAsync(team.Id, 0, user.Id);

        // Assert
        Assert.Null(await context.LineupEntries.FirstOrDefaultAsync());
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_TwoDifferentConstructors_CreateTwoLineupEntries()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var constructor1 = CreateTestConstructor(context, "Red Bull Racing");
        var constructor2 = CreateTestConstructor(context, "Ferrari");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act
        await service.AddConstructorToTeamAsync(team.Id, constructor1.Id, 0, user.Id);
        await service.AddConstructorToTeamAsync(team.Id, constructor2.Id, 1, user.Id);

        // Assert
        Assert.Equal(2, await context.LineupEntries.CountAsync());
    }

    [Fact]
    public async Task AddDriverToTeamAsync_AtomicSave_TeamDriverAndLineupEntryBothPersist()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Assert
        Assert.Equal(1, await context.TeamDrivers.CountAsync());
        Assert.Equal(1, await context.LineupEntries.CountAsync());
    }

    #endregion

    #region SetCaptainAsync Tests

    [Fact]
    public async Task SetCaptainAsync_ValidDriver_SetsCaptainFlag()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act
        await service.SetCaptainAsync(team.Id, driver.Id, user.Id);

        // Assert
        var entry = await context.LineupEntries.FirstOrDefaultAsync(le =>
            le.TeamId == team.Id && le.RaceWeekendId == race.Id && le.EntityId == driver.Id
        );
        Assert.NotNull(entry);
        Assert.True(entry.IsCaptain);
    }

    [Fact]
    public async Task SetCaptainAsync_ExistingCaptain_ClearsExistingAndSetsNew()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver1 = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var driver2 = CreateTestDriver(context, "NOR", "Lando", "Norris");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );
        await service.AddDriverToTeamAsync(team.Id, driver1.Id, 0, user.Id);
        await service.AddDriverToTeamAsync(team.Id, driver2.Id, 1, user.Id);
        await service.SetCaptainAsync(team.Id, driver1.Id, user.Id);

        // Act
        await service.SetCaptainAsync(team.Id, driver2.Id, user.Id);

        // Assert
        var entry1 = await context.LineupEntries.FirstOrDefaultAsync(le =>
            le.TeamId == team.Id && le.RaceWeekendId == race.Id && le.EntityId == driver1.Id
        );
        var entry2 = await context.LineupEntries.FirstOrDefaultAsync(le =>
            le.TeamId == team.Id && le.RaceWeekendId == race.Id && le.EntityId == driver2.Id
        );
        Assert.NotNull(entry1);
        Assert.False(entry1.IsCaptain);
        Assert.NotNull(entry2);
        Assert.True(entry2.IsCaptain);
    }

    [Fact]
    public async Task SetCaptainAsync_NullDriverId_ClearsExistingCaptain()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        var race = CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);
        await service.SetCaptainAsync(team.Id, driver.Id, user.Id);

        // Act
        await service.SetCaptainAsync(team.Id, null, user.Id);

        // Assert
        var entry = await context.LineupEntries.FirstOrDefaultAsync(le =>
            le.TeamId == team.Id && le.RaceWeekendId == race.Id && le.EntityId == driver.Id
        );
        Assert.NotNull(entry);
        Assert.False(entry.IsCaptain);
    }

    [Fact]
    public async Task SetCaptainAsync_ThrowsIfLineupLocked()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(-1)
        );

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LineupLockedException>(() =>
            service.SetCaptainAsync(team.Id, 1, user.Id)
        );
        Assert.Equal("Test Grand Prix", exception.RaceName);
    }

    [Fact]
    public async Task SetCaptainAsync_NoUpcomingRace_ThrowsNoUpcomingRaceException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        // No race seeded

        // Act & Assert
        await Assert.ThrowsAsync<NoUpcomingRaceException>(() =>
            service.SetCaptainAsync(team.Id, 1, user.Id)
        );
    }

    [Fact]
    public async Task SetCaptainAsync_ThrowsIfDriverNotInLineup()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );

        // Act & Assert — driver 999 doesn't exist in the lineup
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SetCaptainAsync(team.Id, 999, user.Id)
        );
        Assert.Contains("999", exception.Message);
        Assert.Contains("lineup", exception.Message);
    }

    [Fact]
    public async Task GetUserTeamAsync_WithCaptainSet_DriverIsCaptainIsTrue()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);
        await service.SetCaptainAsync(team.Id, driver.Id, user.Id);

        // Act
        var result = await service.GetUserTeamAsync(user.Id);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.Drivers.Single(d => d.Id == driver.Id).IsCaptain);
    }

    [Fact]
    public async Task GetUserTeamAsync_NoCaptainSet_AllDriversIsCaptainIsFalse()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = CreateService(context);

        var user = CreateTestUser(context);
        var team = CreateTestTeam(context, user.Id);
        var driver = CreateTestDriver(context, "VER", "Max", "Verstappen");
        CreateTestRace(
            context,
            raceDate: DateTime.UtcNow.AddDays(2),
            lockDeadline: DateTime.UtcNow.AddHours(1)
        );
        await service.AddDriverToTeamAsync(team.Id, driver.Id, 0, user.Id);

        // Act
        var result = await service.GetUserTeamAsync(user.Id);

        // Assert
        Assert.NotNull(result);
        Assert.All(result.Drivers, d => Assert.False(d.IsCaptain));
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
            LastName = "Doe",
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
            CreatedAt = DateTime.UtcNow,
        };
        context.Teams.Add(team);
        context.SaveChanges();
        return team;
    }

    private Driver CreateTestDriver(
        ApplicationDbContext context,
        string abbreviation,
        string firstName,
        string lastName,
        decimal price = 1_000_000m
    )
    {
        var driver = new Driver
        {
            FirstName = firstName,
            LastName = lastName,
            Abbreviation = abbreviation,
            CountryAbbreviation = "NL",
            Price = price,
        };
        context.Drivers.Add(driver);
        context.SaveChanges();
        return driver;
    }

    private Constructor CreateTestConstructor(
        ApplicationDbContext context,
        string name,
        decimal price = 1_000_000m
    )
    {
        var constructor = new Constructor
        {
            Name = name,
            FullName = "Test Constructor",
            Abbreviation = name[..3].ToUpper(),
            CountryAbbreviation = "AT",
            Price = price,
        };
        context.Constructors.Add(constructor);
        context.SaveChanges();
        return constructor;
    }

    private RaceWeekend CreateTestRace(
        ApplicationDbContext context,
        DateTime raceDate,
        DateTime? lockDeadline = null
    )
    {
        var circuit = new Circuit
        {
            Name = "Test Circuit",
            Location = "Test",
            Country = "Test Country",
        };
        context.Circuits.Add(circuit);
        context.SaveChanges();

        var race = new RaceWeekend
        {
            SeasonId = 1,
            Round = 1,
            Name = "Test Grand Prix",
            CircuitId = circuit.Id,
            RaceDate = raceDate,
            LockDeadline = lockDeadline,
        };
        context.RaceWeekends.Add(race);
        context.SaveChanges();
        return race;
    }

    #endregion
}
