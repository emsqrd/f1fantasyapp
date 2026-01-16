using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class LeagueServiceTests
{
    private readonly Mock<ILogger<LeagueService>> _mockLogger;

    public LeagueServiceTests()
    {
        _mockLogger = new Mock<ILogger<LeagueService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CreateLeagueAsync_ValidRequest_ReturnsLeagueResponseWithCorrectData()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        var team = new Team
        {
            Name = "Owner's Team",
            UserId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(team);
        await context.SaveChangesAsync();

        var request = new CreateLeagueRequest
        {
            Name = "Test League",
            Description = "Test Description"
        };

        // Act
        var result = await service.CreateLeagueAsync(request, owner.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Test League", result.Name);
        Assert.Equal("Test Description", result.Description);
        Assert.Equal("John Doe", result.OwnerName);
        Assert.Equal(15, result.MaxTeams);
        Assert.True(result.IsPrivate);
    }

    [Fact]
    public async Task CreateLeagueAsync_ValidRequest_PersistsLeagueToDatabase()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "Jane",
            LastName = "Smith"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        var team = new Team
        {
            Name = "Owner's Team",
            UserId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(team);
        await context.SaveChangesAsync();

        var request = new CreateLeagueRequest
        {
            Name = "Persistent League",
            Description = "Should be saved"
        };

        // Act
        await service.CreateLeagueAsync(request, owner.Id);

        // Assert
        var savedLeague = await context.Leagues.FirstOrDefaultAsync();
        Assert.NotNull(savedLeague);
        Assert.Equal("Persistent League", savedLeague.Name);
        Assert.Equal("Should be saved", savedLeague.Description);
        Assert.Equal(owner.Id, savedLeague.OwnerId);
    }

    [Fact]
    public async Task CreateLeagueAsync_NonExistentOwner_ThrowsUserProfileNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var request = new CreateLeagueRequest
        {
            Name = "Test League",
            Description = "Test Description"
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UserProfileNotFoundException>(
            () => service.CreateLeagueAsync(request, 999)
        );
        Assert.Contains("999", exception.Message);
    }

    [Fact]
    public async Task CreateLeagueAsync_OwnerHasNoTeam_ThrowsTeamNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "No",
            LastName = "Team"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        var request = new CreateLeagueRequest
        {
            Name = "Test League",
            Description = "Test Description"
        };

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamNotFoundException>(
            () => service.CreateLeagueAsync(request, owner.Id)
        );
        Assert.Equal(owner.Id, exception.UserId);
    }

    [Fact]
    public async Task GetLeaguesAsync_NoLeagues_ReturnsEmptyCollection()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        // Act
        var result = await service.GetLeaguesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetLeaguesAsync_MultipleLeagues_ReturnsAllLeagues()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "Test",
            LastName = "Owner"
        };
        context.UserProfiles.Add(owner);

        var league1 = new League
        {
            Name = "League 1",
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var league2 = new League
        {
            Name = "League 2",
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };

        context.Leagues.AddRange(league1, league2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
    }

    [Fact]
    public async Task GetLeagueByIdAsync_ExistingLeague_ReturnsLeague()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "Test",
            LastName = "Owner"
        };
        context.UserProfiles.Add(owner);

        var league = new League
        {
            Name = "Test League",
            Description = "Test Description",
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeagueByIdAsync(league.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Test League", result.Name);
        Assert.Equal("Test Description", result.Description);
    }

    [Fact]
    public async Task GetLeagueByIdAsync_NonExistentLeague_ReturnsNull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        // Act
        var result = await service.GetLeagueByIdAsync(999);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public async Task GetLeaguesByOwnerIdAsync_OwnerHasLeagues_ReturnsOnlyOwnerLeagues()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner1 = new UserProfile
        {
            AccountId = "owner1-account",
            Email = "owner1@test.com",
            FirstName = "Owner",
            LastName = "One"
        };
        var owner2 = new UserProfile
        {
            AccountId = "owner2-account",
            Email = "owner2@test.com",
            FirstName = "Owner",
            LastName = "Two"
        };
        context.UserProfiles.AddRange(owner1, owner2);
        await context.SaveChangesAsync();

        var league1 = new League
        {
            Name = "Owner 1 League",
            OwnerId = owner1.Id,
            CreatedBy = owner1.Id,
            CreatedAt = DateTime.UtcNow
        };
        var league2 = new League
        {
            Name = "Owner 2 League",
            OwnerId = owner2.Id,
            CreatedBy = owner2.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(league1, league2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesByOwnerIdAsync(owner1.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Owner 1 League", result.First().Name);
    }

    [Fact]
    public async Task GetLeaguesByOwnerIdAsync_OwnerHasNoLeagues_ReturnsEmptyCollection()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "Test",
            LastName = "Owner"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesByOwnerIdAsync(owner.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public void Constructor_NullDbContext_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.Throws<ArgumentNullException>(() => new LeagueService(null!, _mockLogger.Object));
    }
}
