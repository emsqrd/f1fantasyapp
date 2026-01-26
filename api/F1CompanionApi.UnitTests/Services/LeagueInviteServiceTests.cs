using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class LeagueInviteServiceTests
{
    private readonly Mock<ILogger<LeagueInviteService>> _mockLogger;

    public LeagueInviteServiceTests()
    {
        _mockLogger = new Mock<ILogger<LeagueInviteService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private async Task<(UserProfile owner, League league)> SeedPrivateLeagueWithOwner(ApplicationDbContext context)
    {
        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        var league = new League
        {
            Name = "Private League",
            Description = "Test private league",
            IsPrivate = true,
            MaxTeams = 10,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league);
        await context.SaveChangesAsync();

        return (owner, league);
    }

    #region GetOrCreateLeagueInviteAsync Tests

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_ValidRequest_CreatesNewInviteSuccessfully()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result = await service.GetOrCreateLeagueInviteAsync(league.Id, owner.Id);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result.Token);
        Assert.Equal(10, result.Token.Length);
        Assert.Equal(league.Id, result.LeagueId);

        // Verify invite was persisted
        var savedInvite = await context.LeagueInvites.FirstOrDefaultAsync(x => x.LeagueId == league.Id);
        Assert.NotNull(savedInvite);
        Assert.Equal(result.Token, savedInvite.Token);
        Assert.Equal(owner.Id, savedInvite.CreatedBy);
    }

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_InviteAlreadyExists_ReturnsExistingInvite()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var existingInvite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = "existing-token-123",
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(existingInvite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result = await service.GetOrCreateLeagueInviteAsync(league.Id, owner.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("existing-token-123", result.Token);
        Assert.Equal(league.Id, result.LeagueId);

        // Verify no new invite was created
        var inviteCount = await context.LeagueInvites.CountAsync(x => x.LeagueId == league.Id);
        Assert.Equal(1, inviteCount);
    }

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_NonExistentLeague_ThrowsLeagueNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => service.GetOrCreateLeagueInviteAsync(999, 1)
        );

        Assert.Equal(999, exception.LeagueId);
    }

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_NonOwnerRequester_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (_, league) = await SeedPrivateLeagueWithOwner(context);

        var nonOwner = new UserProfile
        {
            AccountId = "non-owner-account",
            Email = "nonowner@test.com",
            FirstName = "Jane",
            LastName = "Smith"
        };
        context.UserProfiles.Add(nonOwner);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => service.GetOrCreateLeagueInviteAsync(league.Id, nonOwner.Id)
        );

        Assert.Equal("Only league owner can create invites", exception.Message);
    }

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_PublicLeague_ThrowsInvalidOperationException()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        var owner = new UserProfile
        {
            AccountId = "test-account",
            Email = "owner@test.com",
            FirstName = "John",
            LastName = "Doe"
        };
        context.UserProfiles.Add(owner);
        await context.SaveChangesAsync();

        var publicLeague = new League
        {
            Name = "Public League",
            Description = "Test public league",
            IsPrivate = false,
            MaxTeams = 10,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(publicLeague);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetOrCreateLeagueInviteAsync(publicLeague.Id, owner.Id)
        );

        Assert.Equal("Public leagues cannot be joined by league invite", exception.Message);
    }

    #endregion

    #region ValidateAndPreviewLeagueInviteAsync Tests

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_ValidToken_ReturnsLeaguePreview()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        // Add users for the teams
        var user1 = new UserProfile
        {
            AccountId = "user1-account",
            Email = "user1@test.com",
            FirstName = "User",
            LastName = "One"
        };
        var user2 = new UserProfile
        {
            AccountId = "user2-account",
            Email = "user2@test.com",
            FirstName = "User",
            LastName = "Two"
        };
        context.UserProfiles.AddRange(user1, user2);
        await context.SaveChangesAsync();

        // Add some teams to the league
        var team1 = new Team { Name = "Team 1", UserId = user1.Id, CreatedBy = user1.Id, CreatedAt = DateTime.UtcNow };
        var team2 = new Team { Name = "Team 2", UserId = user2.Id, CreatedBy = user2.Id, CreatedAt = DateTime.UtcNow };
        context.Teams.AddRange(team1, team2);
        await context.SaveChangesAsync();

        context.LeagueTeams.AddRange(
            new LeagueTeam { LeagueId = league.Id, TeamId = team1.Id, JoinedAt = DateTime.UtcNow, CreatedBy = user1.Id, CreatedAt = DateTime.UtcNow },
            new LeagueTeam { LeagueId = league.Id, TeamId = team2.Id, JoinedAt = DateTime.UtcNow, CreatedBy = user2.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var token = "validToken1";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result = await service.ValidateAndPreviewLeagueInviteAsync(token);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Private League", result.LeagueName);
        Assert.Equal("Test private league", result.LeagueDescription);
        Assert.Equal("John Doe", result.OwnerName);
        Assert.Equal(2, result.CurrentTeamCount);
        Assert.Equal(10, result.MaxTeams);
        Assert.False(result.IsLeagueFull);
    }

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_ValidTokenForFullLeague_ShowsLeagueIsFull()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        // Update league to have MaxTeams = 2
        league.MaxTeams = 2;
        await context.SaveChangesAsync();

        // Add users for the teams
        var user1 = new UserProfile
        {
            AccountId = "user1-account",
            Email = "user1@test.com",
            FirstName = "User",
            LastName = "One"
        };
        var user2 = new UserProfile
        {
            AccountId = "user2-account",
            Email = "user2@test.com",
            FirstName = "User",
            LastName = "Two"
        };
        context.UserProfiles.AddRange(user1, user2);
        await context.SaveChangesAsync();

        // Add 2 teams (filling the league)
        var team1 = new Team { Name = "Team 1", UserId = user1.Id, CreatedBy = user1.Id, CreatedAt = DateTime.UtcNow };
        var team2 = new Team { Name = "Team 2", UserId = user2.Id, CreatedBy = user2.Id, CreatedAt = DateTime.UtcNow };
        context.Teams.AddRange(team1, team2);
        await context.SaveChangesAsync();

        context.LeagueTeams.AddRange(
            new LeagueTeam { LeagueId = league.Id, TeamId = team1.Id, JoinedAt = DateTime.UtcNow, CreatedBy = user1.Id, CreatedAt = DateTime.UtcNow },
            new LeagueTeam { LeagueId = league.Id, TeamId = team2.Id, JoinedAt = DateTime.UtcNow, CreatedBy = user2.Id, CreatedAt = DateTime.UtcNow }
        );
        await context.SaveChangesAsync();

        var token = "validToken2";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result = await service.ValidateAndPreviewLeagueInviteAsync(token);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.CurrentTeamCount);
        Assert.Equal(2, result.MaxTeams);
        Assert.True(result.IsLeagueFull);
    }

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_ValidTokenButLeagueNotFound_ThrowsInvalidLeagueInviteTokenException()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        var token = "invalidToken";
        // Don't add LeagueInvite to database - simulates invalid token

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidLeagueInviteTokenException>(
            () => service.ValidateAndPreviewLeagueInviteAsync(token)
        );

        Assert.Equal("Invalid or expired invite", exception.InviteToken);
    }

    #endregion

    #region JoinLeagueViaLeagueInviteAsync Tests

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_ValidRequest_SuccessfullyJoinsLeague()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var newUser = new UserProfile
        {
            AccountId = "new-user-account",
            Email = "newuser@test.com",
            FirstName = "Alice",
            LastName = "Johnson"
        };
        context.UserProfiles.Add(newUser);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "Alice's Team",
            UserId = newUser.Id,
            CreatedBy = newUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var token = "testToken1";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        var beforeJoin = DateTime.UtcNow;

        // Act
        var result = await service.JoinLeagueViaLeagueInviteAsync(token, newUser.Id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Private League", result.Name);

        // Verify LeagueTeam was created
        var leagueTeam = await context.LeagueTeams
            .FirstOrDefaultAsync(lt => lt.LeagueId == league.Id && lt.TeamId == userTeam.Id);

        Assert.NotNull(leagueTeam);
        Assert.Equal(newUser.Id, leagueTeam.CreatedBy);
        Assert.True(leagueTeam.JoinedAt >= beforeJoin);
        Assert.True(leagueTeam.CreatedAt >= beforeJoin);
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_LeagueNotFound_ThrowsLeagueNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        var newUser = new UserProfile
        {
            AccountId = "new-user-account",
            Email = "newuser@test.com",
            FirstName = "Alice",
            LastName = "Johnson"
        };
        context.UserProfiles.Add(newUser);
        await context.SaveChangesAsync();

        var token = "testToken2";
        var invite = new LeagueInvite
        {
            LeagueId = 999, // League ID 999 doesn't exist
            Token = token,
            CreatedBy = newUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => service.JoinLeagueViaLeagueInviteAsync(token, newUser.Id)
        );

        Assert.Equal(999, exception.LeagueId);
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_LeagueFull_ThrowsLeagueFullException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        // Set league to max 1 team
        league.MaxTeams = 1;
        await context.SaveChangesAsync();

        // Add one team to fill the league
        var existingUser = new UserProfile
        {
            AccountId = "existing-user",
            Email = "existing@test.com",
            FirstName = "Bob",
            LastName = "Smith"
        };
        context.UserProfiles.Add(existingUser);
        await context.SaveChangesAsync();

        var existingTeam = new Team
        {
            Name = "Bob's Team",
            UserId = existingUser.Id,
            CreatedBy = existingUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(existingTeam);
        await context.SaveChangesAsync();

        context.LeagueTeams.Add(new LeagueTeam
        {
            LeagueId = league.Id,
            TeamId = existingTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = existingUser.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        // New user trying to join
        var newUser = new UserProfile
        {
            AccountId = "new-user-account",
            Email = "newuser@test.com",
            FirstName = "Alice",
            LastName = "Johnson"
        };
        context.UserProfiles.Add(newUser);
        await context.SaveChangesAsync();

        var userTeam = new Team
        {
            Name = "Alice's Team",
            UserId = newUser.Id,
            CreatedBy = newUser.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(userTeam);
        await context.SaveChangesAsync();

        var token = "testToken3";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<LeagueFullException>(
            () => service.JoinLeagueViaLeagueInviteAsync(token, newUser.Id)
        );

        Assert.Equal(league.Id, exception.LeagueId);
        Assert.Equal(1, exception.MaxTeams);
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_UserHasNoTeam_ThrowsTeamNotFoundException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var newUser = new UserProfile
        {
            AccountId = "new-user-account",
            Email = "newuser@test.com",
            FirstName = "Alice",
            LastName = "Johnson"
        };
        context.UserProfiles.Add(newUser);
        await context.SaveChangesAsync();
        // Note: No team created for this user

        var token = "testToken4";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<TeamNotFoundException>(
            () => service.JoinLeagueViaLeagueInviteAsync(token, newUser.Id)
        );

        Assert.Equal(newUser.Id, exception.UserId);
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_UserAlreadyInLeague_ThrowsAlreadyInLeagueException()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var existingMember = new UserProfile
        {
            AccountId = "existing-member",
            Email = "existing@test.com",
            FirstName = "Charlie",
            LastName = "Brown"
        };
        context.UserProfiles.Add(existingMember);
        await context.SaveChangesAsync();

        var memberTeam = new Team
        {
            Name = "Charlie's Team",
            UserId = existingMember.Id,
            CreatedBy = existingMember.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Teams.Add(memberTeam);
        await context.SaveChangesAsync();

        // Add team to league
        context.LeagueTeams.Add(new LeagueTeam
        {
            LeagueId = league.Id,
            TeamId = memberTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = existingMember.Id,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var token = "testToken5";
        var invite = new LeagueInvite
        {
            LeagueId = league.Id,
            Token = token,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.LeagueInvites.Add(invite);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act & Assert
        var exception = await Assert.ThrowsAsync<AlreadyInLeagueException>(
            () => service.JoinLeagueViaLeagueInviteAsync(token, existingMember.Id)
        );

        Assert.Equal(league.Id, exception.LeagueId);
        Assert.Equal(memberTeam.Id, exception.TeamId);
    }

    #endregion

    #region Token Generation Tests

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_GeneratesUniqueToken_WhenCollisionOccurs()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league1) = await SeedPrivateLeagueWithOwner(context);

        // Create second league for the same owner
        var league2 = new League
        {
            Name = "Second Private League",
            Description = "Another test league",
            IsPrivate = true,
            MaxTeams = 10,
            OwnerId = owner.Id,
            CreatedBy = owner.Id,
            CreatedAt = DateTime.UtcNow
        };
        context.Leagues.Add(league2);
        await context.SaveChangesAsync();

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result1 = await service.GetOrCreateLeagueInviteAsync(league1.Id, owner.Id);
        var result2 = await service.GetOrCreateLeagueInviteAsync(league2.Id, owner.Id);

        // Assert
        Assert.NotEqual(result1.Token, result2.Token);
        Assert.Equal(10, result1.Token.Length);
        Assert.Equal(10, result2.Token.Length);

        // Verify both tokens are persisted
        var tokens = await context.LeagueInvites.Select(x => x.Token).ToListAsync();
        Assert.Equal(2, tokens.Count);
        Assert.Contains(result1.Token, tokens);
        Assert.Contains(result2.Token, tokens);
    }

    [Fact]
    public async Task GetOrCreateLeagueInviteAsync_GeneratedToken_UsesUrlSafeCharacters()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var (owner, league) = await SeedPrivateLeagueWithOwner(context);

        var service = new LeagueInviteService(context, _mockLogger.Object);

        // Act
        var result = await service.GetOrCreateLeagueInviteAsync(league.Id, owner.Id);

        // Assert
        var validChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";
        Assert.All(result.Token, c => Assert.Contains(c, validChars));

        // Ensure no confusing characters (0, O, I, l)
        Assert.DoesNotContain('0', result.Token);
        Assert.DoesNotContain('O', result.Token);
        Assert.DoesNotContain('I', result.Token);
        Assert.DoesNotContain('l', result.Token);
    }

    #endregion
}
