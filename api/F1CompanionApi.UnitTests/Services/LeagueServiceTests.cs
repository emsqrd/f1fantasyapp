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
            Description = "Test Description",
            IsPrivate = true,
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
            Description = "Should be saved",
            IsPrivate = true,
        };

        var beforeCreation = DateTime.UtcNow;

        // Act
        await service.CreateLeagueAsync(request, owner.Id);

        // Assert - League is persisted
        var savedLeague = await context.Leagues
            .Include(l => l.LeagueTeams)
                .ThenInclude(lt => lt.Team)
            .FirstOrDefaultAsync();

        Assert.NotNull(savedLeague);
        Assert.Equal("Persistent League", savedLeague.Name);
        Assert.Equal("Should be saved", savedLeague.Description);
        Assert.Equal(owner.Id, savedLeague.OwnerId);
        Assert.True(savedLeague.IsPrivate);

        // Assert - LeagueTeam is created and persisted
        Assert.Single(savedLeague.LeagueTeams);

        var leagueTeam = savedLeague.LeagueTeams.First();
        Assert.Equal(savedLeague.Id, leagueTeam.LeagueId);
        Assert.Equal(team.Id, leagueTeam.TeamId);
        Assert.NotNull(leagueTeam.Team);

        // Assert - LeagueTeam has correct audit fields
        Assert.Equal(owner.Id, leagueTeam.CreatedBy);
        Assert.True(leagueTeam.CreatedAt >= beforeCreation);
        Assert.True(leagueTeam.JoinedAt >= beforeCreation);
        Assert.True(leagueTeam.CreatedAt <= DateTime.UtcNow);
        Assert.True(leagueTeam.JoinedAt <= DateTime.UtcNow);
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
    public async Task GetPublicLeaguesAsync_OnlyPublicLeagues_ReturnsAllLeagues()
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

        var publicLeague1 = new League
        {
            Name = "Public League 1",
            Description = "First public league",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var publicLeague2 = new League
        {
            Name = "Public League 2",
            Description = "Second public league",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(publicLeague1, publicLeague2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_MixedPublicAndPrivate_ReturnsOnlyPublicLeagues()
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

        var publicLeague = new League
        {
            Name = "Public League",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var privateLeague1 = new League
        {
            Name = "Private League 1",
            IsPrivate = true,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var privateLeague2 = new League
        {
            Name = "Private League 2",
            IsPrivate = true,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(publicLeague, privateLeague1, privateLeague2);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Public League", result.First().Name);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_SearchByName_ReturnsMatchingLeagues()
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

        var premierLeague = new League
        {
            Name = "Premier League Champions",
            Description = "For the best players",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var casualLeague = new League
        {
            Name = "Casual Sunday League",
            Description = "Just for fun",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var eliteLeague = new League
        {
            Name = "Elite Competition",
            Description = "Top tier only",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(premierLeague, casualLeague, eliteLeague);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync("League");

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
        Assert.Contains(result, l => l.Name == "Premier League Champions");
        Assert.Contains(result, l => l.Name == "Casual Sunday League");
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_SearchByDescription_ReturnsMatchingLeagues()
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

        var competitiveLeague = new League
        {
            Name = "Alpha League",
            Description = "For competitive players only",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var casualLeague = new League
        {
            Name = "Beta League",
            Description = "Casual and fun environment",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(competitiveLeague, casualLeague);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync("competitive");

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Alpha League", result.First().Name);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_SearchCaseInsensitive_ReturnsMatchingLeagues()
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
            Name = "PREMIER League",
            Description = "Elite COMPETITION",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Act - Search with different casing
        var resultLower = await service.GetPublicLeaguesAsync("premier");
        var resultDescUpper = await service.GetPublicLeaguesAsync("COMPETITION");

        // Assert
        Assert.Single(resultLower);
        Assert.Single(resultDescUpper);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_SearchWithNoMatches_ReturnsEmptyCollection()
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
            Name = "Premier League",
            Description = "Top tier competition",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync("nonexistent");

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_NullOrWhitespaceSearchTerm_ReturnsAllPublicLeagues()
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
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var league2 = new League
        {
            Name = "League 2",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(league1, league2);
        await context.SaveChangesAsync();

        // Act - Test both null and whitespace
        var resultNull = await service.GetPublicLeaguesAsync(null);
        var resultWhitespace = await service.GetPublicLeaguesAsync("   ");

        // Assert
        Assert.NotNull(resultNull);
        Assert.Equal(2, resultNull.Count());
        Assert.NotNull(resultWhitespace);
        Assert.Equal(2, resultWhitespace.Count());
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_NullDescription_DoesNotThrowException()
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

        var leagueWithoutDescription = new League
        {
            Name = "No Description League",
            Description = null,
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(leagueWithoutDescription);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync("xyz");

        // Assert - Should not throw when searching leagues with null descriptions
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_IncludesOwnerInformation()
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

        var league = new League
        {
            Name = "Test League",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync();

        // Assert
        Assert.NotNull(result);
        var leagueResponse = result.First();
        Assert.Equal("John Doe", leagueResponse.OwnerName);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_SearchFiltersOutPrivateLeagues()
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

        var publicLeague = new League
        {
            Name = "Champions League",
            Description = "Public competition",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var privateLeague = new League
        {
            Name = "Champions Private",
            Description = "Private competition",
            IsPrivate = true,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(publicLeague, privateLeague);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetPublicLeaguesAsync("Champions");

        // Assert - Should only return public league even though both match search
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("Champions League", result.First().Name);
    }

    [Fact]
    public void Constructor_NullDbContext_ThrowsArgumentNullException()
    {
        // Act & Assert
        Assert.Throws<ArgumentNullException>(() => new LeagueService(null!, _mockLogger.Object));
    }

    #region GetLeaguesForUserAsync Tests

    [Fact]
    public async Task GetLeaguesForUserAsync_UserOwnsLeagues_ReturnsOwnedLeagues()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner"
        };
        var otherUser = new UserProfile
        {
            AccountId = "other-account",
            Email = "other@test.com",
            FirstName = "Other",
            LastName = "User"
        };
        context.UserProfiles.AddRange(owner, otherUser);
        await context.SaveChangesAsync();

        var ownedLeague1 = new League
        {
            Name = "Owned League 1",
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var ownedLeague2 = new League
        {
            Name = "Owned League 2",
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var otherLeague = new League
        {
            Name = "Other League",
            OwnerId = otherUser.Id,
            CreatedBy = otherUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(ownedLeague1, ownedLeague2, otherLeague);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesForUserAsync(owner.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
        Assert.Contains(result, l => l.Name == "Owned League 1");
        Assert.Contains(result, l => l.Name == "Owned League 2");
        Assert.DoesNotContain(result, l => l.Name == "Other League");
    }

    [Fact]
    public async Task GetLeaguesForUserAsync_UserIsMemberOnly_ReturnsMemberLeagues()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var leagueOwner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner"
        };
        var member = new UserProfile
        {
            AccountId = "member-account",
            Email = "member@test.com",
            FirstName = "Member",
            LastName = "User"
        };
        context.UserProfiles.AddRange(leagueOwner, member);
        await context.SaveChangesAsync();

        var memberTeam = new Team
        {
            Name = "Member Team",
            UserId = member.Id,
            CreatedBy = member.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(memberTeam);
        await context.SaveChangesAsync();

        var league1 = new League
        {
            Name = "League 1",
            OwnerId = leagueOwner.Id,
            CreatedBy = leagueOwner.Id,
            CreatedAt = DateTime.UtcNow
        };
        var league2 = new League
        {
            Name = "League 2",
            OwnerId = leagueOwner.Id,
            CreatedBy = leagueOwner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(league1, league2);
        await context.SaveChangesAsync();

        // Add member's team to league1 only
        var leagueTeam = new LeagueTeam
        {
            LeagueId = league1.Id,
            TeamId = memberTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = member.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueTeams.Add(leagueTeam);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesForUserAsync(member.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result);
        Assert.Equal("League 1", result.First().Name);
    }

    [Fact]
    public async Task GetLeaguesForUserAsync_UserIsOwnerAndMember_ReturnsDistinctLeagues()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Test",
            LastName = "User"
        };
        var otherOwner = new UserProfile
        {
            AccountId = "other-account",
            Email = "other@test.com",
            FirstName = "Other",
            LastName = "Owner"
        };
        context.UserProfiles.AddRange(user, otherOwner);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "User Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var ownedLeague = new League
        {
            Name = "Owned League",
            OwnerId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        var joinedLeague = new League
        {
            Name = "Joined League",
            OwnerId = otherOwner.Id,
            CreatedBy = otherOwner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.AddRange(ownedLeague, joinedLeague);
        await context.SaveChangesAsync();

        var leagueTeam = new LeagueTeam
        {
            LeagueId = joinedLeague.Id,
            TeamId = userTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueTeams.Add(leagueTeam);
        await context.SaveChangesAsync();

        // Act
        var result = await service.GetLeaguesForUserAsync(user.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Count());
        Assert.Contains(result, l => l.Name == "Owned League");
        Assert.Contains(result, l => l.Name == "Joined League");
    }

    #endregion

    #region JoinLeagueAsync Tests

    [Fact]
    public async Task JoinLeagueAsync_ValidRequest_CreatesLeagueTeamAndReturnsLeague()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner"
        };
        var joiningUser = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Joining",
            LastName = "User"
        };
        context.UserProfiles.AddRange(owner, joiningUser);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "User Team",
            UserId = joiningUser.Id,
            CreatedBy = joiningUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var league = new League
        {
            Name = "Public League",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        var beforeJoin = DateTime.UtcNow;

        // Act
        var result = await service.JoinLeagueAsync(league.Id, joiningUser.Id);

        // Assert - Returns league response
        Assert.NotNull(result);
        Assert.Equal("Public League", result.Name);

        // Assert - LeagueTeam is persisted
        var leagueTeam = await context.LeagueTeams
            .FirstOrDefaultAsync(lt => lt.LeagueId == league.Id && lt.TeamId == userTeam.Id);

        Assert.NotNull(leagueTeam);
        Assert.Equal(league.Id, leagueTeam.LeagueId);
        Assert.Equal(userTeam.Id, leagueTeam.TeamId);
        Assert.Equal(joiningUser.Id, leagueTeam.CreatedBy);
        Assert.True(leagueTeam.JoinedAt >= beforeJoin);
        Assert.True(leagueTeam.CreatedAt >= beforeJoin);
    }

    [Fact]
    public async Task JoinLeagueAsync_InvalidLeagueId_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => service.JoinLeagueAsync(0, 1)
        );
        Assert.Equal("leagueId", exception.ParamName);
    }

    [Fact]
    public async Task JoinLeagueAsync_InvalidUserId_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<ArgumentOutOfRangeException>(
            () => service.JoinLeagueAsync(1, 0)
        );
        Assert.Equal("userId", exception.ParamName);
    }

    [Fact]
    public async Task JoinLeagueAsync_LeagueNotFound_ThrowsLeagueNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var user = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Test",
            LastName = "User"
        };
        context.UserProfiles.Add(user);
        await context.SaveChangesAsync();

        var nonExistentLeagueId = 9999;

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => service.JoinLeagueAsync(nonExistentLeagueId, user.Id)
        );
        Assert.Equal(nonExistentLeagueId, exception.LeagueId);
    }

    [Fact]
    public async Task JoinLeagueAsync_PrivateLeague_ThrowsLeagueIsPrivateException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "Owner",
            LastName = "User"
        };
        var joiningUser = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Joining",
            LastName = "User"
        };
        context.UserProfiles.AddRange(owner, joiningUser);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "User Team",
            UserId = joiningUser.Id,
            CreatedBy = joiningUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var privateLeague = new League
        {
            Name = "Private League",
            IsPrivate = true,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(privateLeague);
        await context.SaveChangesAsync();

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueIsPrivateException>(
            () => service.JoinLeagueAsync(privateLeague.Id, joiningUser.Id)
        );
        Assert.Equal(privateLeague.Id, exception.LeagueId);
    }

    [Fact]
    public async Task JoinLeagueAsync_FullLeague_ThrowsLeagueFullException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "Owner",
            LastName = "User"
        };
        var joiningUser = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Joining",
            LastName = "User"
        };
        context.UserProfiles.AddRange(owner, joiningUser);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "User Team",
            UserId = joiningUser.Id,
            CreatedBy = joiningUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var league = new League
        {
            Name = "Full League",
            IsPrivate = false,
            MaxTeams = 2,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Fill the league to capacity with dummy teams
        for (int i = 0; i < 2; i++)
        {
            var dummyUser = new UserProfile
            {
                AccountId = $"dummy-{i}",
                Email = $"dummy{i}@test.com",
                FirstName = "Dummy",
                LastName = $"User{i}"
            };
            context.UserProfiles.Add(dummyUser);
            await context.SaveChangesAsync();

            var dummyTeam = new Team
            {
                Name = $"Dummy Team {i}",
                UserId = dummyUser.Id,
                CreatedBy = dummyUser.Id,
                CreatedAt = DateTime.UtcNow
            };
            context.Teams.Add(dummyTeam);
            await context.SaveChangesAsync();

            var leagueTeam = new LeagueTeam
            {
                LeagueId = league.Id,
                TeamId = dummyTeam.Id,
                JoinedAt = DateTime.UtcNow,
                CreatedBy = dummyUser.Id,
                CreatedAt = DateTime.UtcNow
            };
            context.LeagueTeams.Add(leagueTeam);
            await context.SaveChangesAsync();
        }

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueFullException>(
            () => service.JoinLeagueAsync(league.Id, joiningUser.Id)
        );
        Assert.Equal(league.Id, exception.LeagueId);
        Assert.Equal(2, exception.MaxTeams);
    }

    [Fact]
    public async Task JoinLeagueAsync_UserHasNoTeam_ThrowsTeamNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "Owner",
            LastName = "User"
        };
        var userWithoutTeam = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "No",
            LastName = "Team"
        };
        context.UserProfiles.AddRange(owner, userWithoutTeam);
        await context.SaveChangesAsync();

        var league = new League
        {
            Name = "Public League",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamNotFoundException>(
            () => service.JoinLeagueAsync(league.Id, userWithoutTeam.Id)
        );
        Assert.Equal(userWithoutTeam.Id, exception.UserId);
    }

    [Fact]
    public async Task JoinLeagueAsync_AlreadyInLeague_ThrowsAlreadyInLeagueException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueService(context, _mockLogger.Object);

        var owner = new UserProfile
        {
            AccountId = "owner-account",
            Email = "owner@test.com",
            FirstName = "Owner",
            LastName = "User"
        };
        var user = new UserProfile
        {
            AccountId = "user-account",
            Email = "user@test.com",
            FirstName = "Test",
            LastName = "User"
        };
        context.UserProfiles.AddRange(owner, user);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "User Team",
            UserId = user.Id,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var league = new League
        {
            Name = "Public League",
            IsPrivate = false,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        // User already in league
        var existingLeagueTeam = new LeagueTeam
        {
            LeagueId = league.Id,
            TeamId = userTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = user.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueTeams.Add(existingLeagueTeam);
        await context.SaveChangesAsync();

        // Act & Assert
        var exception = await Assert.ThrowsAsync<AlreadyInLeagueException>(
            () => service.JoinLeagueAsync(league.Id, user.Id)
        );
        Assert.Equal(league.Id, exception.LeagueId);
        Assert.Equal(userTeam.Id, exception.TeamId);
    }

    #endregion
}
