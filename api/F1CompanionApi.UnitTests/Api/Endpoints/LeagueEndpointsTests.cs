using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class LeagueEndpointsTests
{
    private readonly Mock<ISupabaseAuthService> _mockAuthService;
    private readonly Mock<IUserProfileService> _mockUserProfileService;
    private readonly Mock<ILeagueService> _mockLeagueService;
    private readonly Mock<ILeagueInviteService> _mockLeagueInviteService;
    private readonly Mock<HttpContext> _mockHttpContext;
    private readonly Mock<ILogger> _mockLogger;

    public LeagueEndpointsTests()
    {
        _mockAuthService = new Mock<ISupabaseAuthService>();
        _mockUserProfileService = new Mock<IUserProfileService>();
        _mockLeagueService = new Mock<ILeagueService>();
        _mockLeagueInviteService = new Mock<ILeagueInviteService>();
        _mockHttpContext = new Mock<HttpContext>();
        _mockLogger = new Mock<ILogger>();
    }

    [Fact]
    public async Task CreateLeagueAsync_ValidRequest_ReturnsCreatedResult()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        var request = new CreateLeagueRequest
        {
            Name = "Test League",
            Description = "Test Description"
        };

        var expectedResponse = new LeagueResponse
        {
            Id = 1,
            Name = "Test League",
            Description = "Test Description",
            OwnerName = "John Doe",
            MaxTeams = 15,
            IsPrivate = true
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.CreateLeagueAsync(request, userProfile.Id))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await InvokeCreateLeagueAsync(request);

        // Assert
        Assert.IsType<Created<LeagueResponse>>(result);
        var createdResult = (Created<LeagueResponse>)result;
        Assert.Equal("/leagues/1", createdResult.Location);
        Assert.Equal(expectedResponse, createdResult.Value);
    }

    [Fact]
    public async Task CreateLeagueAsync_UnexpectedExceptionThrown_RethrowsException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        var request = new CreateLeagueRequest
        {
            Name = "Test League"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.CreateLeagueAsync(request, userProfile.Id))
            .ThrowsAsync(new Exception("Database connection failed"));

        // Act & Assert
        await Assert.ThrowsAsync<Exception>(
            () => InvokeCreateLeagueAsync(request)
        );
    }

    [Fact]
    public async Task GetLeaguesAsync_LeaguesExist_ReturnsOkWithLeagues()
    {
        // Arrange
        var leagues = new List<LeagueResponse>
        {
            new LeagueResponse
            {
                Id = 1,
                Name = "League 1",
                Description = "Description 1",
                OwnerName = "John Doe",
                MaxTeams = 15,
                IsPrivate = true
            },
            new LeagueResponse
            {
                Id = 2,
                Name = "League 2",
                OwnerName = "John Doe",
                MaxTeams = 20,
                IsPrivate = false
            }
        };

        _mockLeagueService
            .Setup(x => x.GetLeaguesAsync())
            .ReturnsAsync(leagues);

        // Act
        var result = await InvokeGetLeaguesAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        var leagueList = okResult.Value.ToList();
        Assert.Equal(2, leagueList.Count);
        Assert.Equal("League 1", leagueList[0].Name);
        Assert.Equal("League 2", leagueList[1].Name);
    }

    [Fact]
    public async Task GetLeaguesAsync_NoLeagues_ReturnsOkWithEmptyCollection()
    {
        // Arrange
        _mockLeagueService
            .Setup(x => x.GetLeaguesAsync())
            .ReturnsAsync(new List<LeagueResponse>());

        // Act
        var result = await InvokeGetLeaguesAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Empty(okResult.Value);
    }

    [Fact]
    public async Task GetLeaguesAsync_ServiceReturnsEmptyCollection_ReturnsOkWithEmptyCollection()
    {
        // Arrange
        _mockLeagueService
            .Setup(x => x.GetLeaguesAsync())
            .ReturnsAsync(Array.Empty<LeagueResponse>());

        // Act
        var result = await InvokeGetLeaguesAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Empty(okResult.Value);
    }

    [Fact]
    public async Task GetLeagueByIdAsync_LeagueExists_ReturnsOkWithLeague()
    {
        // Arrange
        var league = new LeagueDetailsResponse
        {
            Id = 1,
            Name = "Test League",
            Description = "Test Description",
            OwnerName = "John Doe",
            MaxTeams = 15,
            IsPrivate = true
        };

        _mockLeagueService
            .Setup(x => x.GetLeagueByIdAsync(1))
            .ReturnsAsync(league);

        // Act
        var result = await InvokeGetLeagueByIdAsync(1);

        // Assert
        Assert.IsType<Ok<LeagueDetailsResponse>>(result);
        var okResult = (Ok<LeagueDetailsResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(1, okResult.Value.Id);
        Assert.Equal("Test League", okResult.Value.Name);
        Assert.Equal("John Doe", okResult.Value.OwnerName);
    }

    [Fact]
    public async Task GetLeagueByIdAsync_LeagueDoesNotExist_ReturnsNotFound()
    {
        // Arrange
        _mockLeagueService
            .Setup(x => x.GetLeagueByIdAsync(999))
            .ReturnsAsync((LeagueDetailsResponse?)null);

        // Act
        var result = await InvokeGetLeagueByIdAsync(999);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_WithoutSearchTerm_ReturnsOkWithAvailableLeagues()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        var availableLeagues = new List<LeagueResponse>
        {
            new LeagueResponse
            {
                Id = 1,
                Name = "Available League 1",
                OwnerName = "John Doe",
                MaxTeams = 15,
                TeamCount = 5,
                IsPrivate = false
            },
            new LeagueResponse
            {
                Id = 2,
                Name = "Available League 2",
                OwnerName = "Jane Smith",
                MaxTeams = 20,
                TeamCount = 10,
                IsPrivate = false
            }
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.GetAvailableLeaguesAsync(userProfile.Id, null))
            .ReturnsAsync(availableLeagues);

        // Act
        var result = await InvokeGetPublicLeaguesAsync(null);

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(availableLeagues, okResult.Value);
        _mockLeagueService.Verify(x => x.GetAvailableLeaguesAsync(userProfile.Id, null), Times.Once);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_WithSearchTerm_ReturnsOkWithFilteredLeagues()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        var searchTerm = "Championship";
        var filteredLeagues = new List<LeagueResponse>
        {
            new LeagueResponse
            {
                Id = 3,
                Name = "World Championship League",
                OwnerName = "Admin User",
                MaxTeams = 30,
                TeamCount = 15,
                IsPrivate = false
            }
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.GetAvailableLeaguesAsync(userProfile.Id, searchTerm))
            .ReturnsAsync(filteredLeagues);

        // Act
        var result = await InvokeGetPublicLeaguesAsync(searchTerm);

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(filteredLeagues, okResult.Value);
        _mockLeagueService.Verify(x => x.GetAvailableLeaguesAsync(userProfile.Id, searchTerm), Times.Once);
    }

    [Fact]
    public async Task JoinLeagueAsync_ValidRequest_ReturnsOkWithLeague()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        var leagueResponse = new LeagueResponse
        {
            Id = 10,
            Name = "Public League",
            Description = "Open to all",
            OwnerName = "League Owner",
            MaxTeams = 15,
            IsPrivate = false
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(10, userProfile.Id))
            .ReturnsAsync(leagueResponse);

        // Act
        var result = await InvokeJoinLeagueAsync(10);

        // Assert
        Assert.IsType<Ok<LeagueResponse>>(result);
        var okResult = (Ok<LeagueResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(10, okResult.Value.Id);
        Assert.Equal("Public League", okResult.Value.Name);
        _mockLeagueService.Verify(x => x.JoinLeagueAsync(10, userProfile.Id), Times.Once);
    }

    [Fact]
    public async Task JoinLeagueAsync_LeagueNotFound_ThrowsLeagueNotFoundException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(999, userProfile.Id))
            .ThrowsAsync(new LeagueNotFoundException(999));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => InvokeJoinLeagueAsync(999)
        );
    }

    [Fact]
    public async Task JoinLeagueAsync_PrivateLeague_ThrowsLeagueIsPrivateException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(10, userProfile.Id))
            .ThrowsAsync(new LeagueIsPrivateException(10));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueIsPrivateException>(
            () => InvokeJoinLeagueAsync(10)
        );
    }

    [Fact]
    public async Task JoinLeagueAsync_LeagueFull_ThrowsLeagueFullException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(10, userProfile.Id))
            .ThrowsAsync(new LeagueFullException(10, 15));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueFullException>(
            () => InvokeJoinLeagueAsync(10)
        );
    }

    [Fact]
    public async Task JoinLeagueAsync_AlreadyInLeague_ThrowsAlreadyInLeagueException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(10, userProfile.Id))
            .ThrowsAsync(new AlreadyInLeagueException(10, 20));

        // Act & Assert
        await Assert.ThrowsAsync<AlreadyInLeagueException>(
            () => InvokeJoinLeagueAsync(10)
        );
    }

    [Fact]
    public async Task JoinLeagueAsync_UserHasNoTeam_ThrowsTeamNotFoundException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "joiner@test.com",
            FirstName = "Jane",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.JoinLeagueAsync(10, userProfile.Id))
            .ThrowsAsync(new TeamNotFoundException(userProfile.Id));

        // Act & Assert
        await Assert.ThrowsAsync<TeamNotFoundException>(
            () => InvokeJoinLeagueAsync(10)
        );
    }

    #region GetOrCreateInviteAsync Tests

    [Fact]
    public async Task GetOrCreateInviteAsync_ExistingInvite_ReturnsOkWithInvite()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow
        };

        var expectedInvite = new LeagueInviteTokenResponse
        {
            Id = 100,
            LeagueId = 10,
            Token = "encrypted-token-abc123",
            CreatedAt = DateTime.UtcNow.AddDays(-1),
            CreatedByName = "League Owner"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.GetOrCreateLeagueInviteAsync(10, userProfile.Id))
            .ReturnsAsync(expectedInvite);

        // Act
        var result = await InvokeGetOrCreateInviteAsync(10);

        // Assert
        Assert.IsType<Ok<LeagueInviteTokenResponse>>(result);
        var okResult = (Ok<LeagueInviteTokenResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(expectedInvite.Id, okResult.Value.Id);
        Assert.Equal(expectedInvite.Token, okResult.Value.Token);
        Assert.Equal(expectedInvite.LeagueId, okResult.Value.LeagueId);
        _mockLeagueInviteService.Verify(x => x.GetOrCreateLeagueInviteAsync(10, userProfile.Id), Times.Once);
    }

    [Fact]
    public async Task GetOrCreateInviteAsync_LeagueNotFound_ThrowsLeagueNotFoundException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.GetOrCreateLeagueInviteAsync(999, userProfile.Id))
            .ThrowsAsync(new LeagueNotFoundException(999));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => InvokeGetOrCreateInviteAsync(999)
        );
    }

    [Fact]
    public async Task GetOrCreateInviteAsync_NotLeagueOwner_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 5,
            Email = "notowner@test.com",
            FirstName = "Not",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.GetOrCreateLeagueInviteAsync(10, userProfile.Id))
            .ThrowsAsync(new UnauthorizedAccessException("Only league owner can create invites"));

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => InvokeGetOrCreateInviteAsync(10)
        );
    }

    [Fact]
    public async Task GetOrCreateInviteAsync_PublicLeague_ThrowsInvalidOperationException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "owner@test.com",
            FirstName = "League",
            LastName = "Owner",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.GetOrCreateLeagueInviteAsync(10, userProfile.Id))
            .ThrowsAsync(new InvalidOperationException("Public leagues cannot be joined by league invite"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => InvokeGetOrCreateInviteAsync(10)
        );
    }

    #endregion

    #region ValidateAndPreviewLeagueInviteAsync Tests

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_ValidToken_ReturnsOkWithPreview()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 3,
            Email = "joiner@test.com",
            FirstName = "John",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        var token = "valid-encrypted-token-abc123";
        var preview = new LeagueInviteTokenPreviewResponse
        {
            LeagueName = "Elite F1 League",
            LeagueDescription = "For serious F1 fans only",
            OwnerName = "League Master",
            CurrentTeamCount = 8,
            MaxTeams = 15,
            IsLeagueFull = false
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.ValidateAndPreviewLeagueInviteAsync(token))
            .ReturnsAsync(preview);

        // Act
        var result = await InvokeValidateAndPreviewLeagueInviteAsync(token);

        // Assert
        Assert.IsType<Ok<LeagueInviteTokenPreviewResponse>>(result);
        var okResult = (Ok<LeagueInviteTokenPreviewResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal("Elite F1 League", okResult.Value.LeagueName);
        Assert.Equal("League Master", okResult.Value.OwnerName);
        Assert.Equal(8, okResult.Value.CurrentTeamCount);
        Assert.Equal(15, okResult.Value.MaxTeams);
        Assert.False(okResult.Value.IsLeagueFull);
        _mockLeagueInviteService.Verify(x => x.ValidateAndPreviewLeagueInviteAsync(token), Times.Once);
    }

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_InvalidToken_ThrowsInvalidLeagueInviteTokenException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 3,
            Email = "joiner@test.com",
            FirstName = "John",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        var invalidToken = "invalid-malformed-token";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.ValidateAndPreviewLeagueInviteAsync(invalidToken))
            .ThrowsAsync(new InvalidLeagueInviteTokenException("Invalid token format"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidLeagueInviteTokenException>(
            () => InvokeValidateAndPreviewLeagueInviteAsync(invalidToken)
        );
    }

    [Fact]
    public async Task ValidateAndPreviewLeagueInviteAsync_LeagueNotFound_ThrowsInvalidLeagueInviteTokenException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 3,
            Email = "joiner@test.com",
            FirstName = "John",
            LastName = "Joiner",
            CreatedAt = DateTime.UtcNow
        };

        var tokenForDeletedLeague = "valid-token-for-deleted-league";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.ValidateAndPreviewLeagueInviteAsync(tokenForDeletedLeague))
            .ThrowsAsync(new InvalidLeagueInviteTokenException("League not found"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidLeagueInviteTokenException>(
            () => InvokeValidateAndPreviewLeagueInviteAsync(tokenForDeletedLeague)
        );
    }

    #endregion

    #region JoinLeagueViaLeagueInviteAsync Tests

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_ValidToken_ReturnsOkWithLeague()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "newmember@test.com",
            FirstName = "New",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var token = "valid-invite-token-abc123";
        var joinedLeague = new LeagueResponse
        {
            Id = 10,
            Name = "Private F1 League",
            Description = "Invite-only league",
            OwnerName = "League Owner",
            MaxTeams = 15,
            TeamCount = 9,
            IsPrivate = true
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id))
            .ReturnsAsync(joinedLeague);

        // Act
        var result = await InvokeJoinLeagueViaLeagueInviteAsync(token);

        // Assert
        Assert.IsType<Ok<LeagueResponse>>(result);
        var okResult = (Ok<LeagueResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(10, okResult.Value.Id);
        Assert.Equal("Private F1 League", okResult.Value.Name);
        Assert.True(okResult.Value.IsPrivate);
        _mockLeagueInviteService.Verify(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id), Times.Once);
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_LeagueNotFound_ThrowsLeagueNotFoundException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "newmember@test.com",
            FirstName = "New",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var token = "token-for-deleted-league";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id))
            .ThrowsAsync(new LeagueNotFoundException(999));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueNotFoundException>(
            () => InvokeJoinLeagueViaLeagueInviteAsync(token)
        );
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_LeagueFull_ThrowsLeagueFullException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "newmember@test.com",
            FirstName = "New",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var token = "token-for-full-league";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id))
            .ThrowsAsync(new LeagueFullException(10, 15));

        // Act & Assert
        await Assert.ThrowsAsync<LeagueFullException>(
            () => InvokeJoinLeagueViaLeagueInviteAsync(token)
        );
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_UserHasNoTeam_ThrowsTeamNotFoundException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "newmember@test.com",
            FirstName = "New",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var token = "valid-invite-token";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id))
            .ThrowsAsync(new TeamNotFoundException(userProfile.Id));

        // Act & Assert
        await Assert.ThrowsAsync<TeamNotFoundException>(
            () => InvokeJoinLeagueViaLeagueInviteAsync(token)
        );
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_AlreadyInLeague_ThrowsAlreadyInLeagueException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "existing@test.com",
            FirstName = "Existing",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var token = "valid-invite-token";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(token, userProfile.Id))
            .ThrowsAsync(new AlreadyInLeagueException(10, 50));

        // Act & Assert
        await Assert.ThrowsAsync<AlreadyInLeagueException>(
            () => InvokeJoinLeagueViaLeagueInviteAsync(token)
        );
    }

    [Fact]
    public async Task JoinLeagueViaLeagueInviteAsync_InvalidToken_ThrowsInvalidLeagueInviteTokenException()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 7,
            Email = "newmember@test.com",
            FirstName = "New",
            LastName = "Member",
            CreatedAt = DateTime.UtcNow
        };

        var invalidToken = "corrupted-token-data";

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueInviteService
            .Setup(x => x.JoinLeagueViaLeagueInviteAsync(invalidToken, userProfile.Id))
            .ThrowsAsync(new InvalidLeagueInviteTokenException("Invalid token format"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidLeagueInviteTokenException>(
            () => InvokeJoinLeagueViaLeagueInviteAsync(invalidToken)
        );
    }

    #endregion

    // Helper methods to invoke private endpoint methods via reflection
    private async Task<IResult> InvokeCreateLeagueAsync(CreateLeagueRequest request)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "CreateLeagueAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockHttpContext.Object,
                _mockAuthService.Object,
                _mockUserProfileService.Object,
                _mockLeagueService.Object,
                request,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetLeaguesAsync()
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "GetLeaguesAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockLeagueService.Object, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetLeagueByIdAsync(int id)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "GetLeagueByIdAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { _mockLeagueService.Object, id, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetPublicLeaguesAsync(string? searchTerm)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "GetAvailableLeaguesAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object?[] { _mockLeagueService.Object, _mockUserProfileService.Object, searchTerm, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeJoinLeagueAsync(int leagueId)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "JoinLeagueAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockLeagueService.Object,
                _mockUserProfileService.Object,
                leagueId,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetOrCreateInviteAsync(int leagueId)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "GetOrCreateInviteAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockLeagueInviteService.Object,
                _mockUserProfileService.Object,
                leagueId,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeValidateAndPreviewLeagueInviteAsync(string token)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "ValidateAndPreviewLeagueInviteAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockLeagueInviteService.Object,
                _mockUserProfileService.Object,
                token,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeJoinLeagueViaLeagueInviteAsync(string token)
    {
        var method = typeof(LeagueEndpoints).GetMethod(
            "JoinLeagueViaLeagueInviteAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockLeagueInviteService.Object,
                _mockUserProfileService.Object,
                token,
                _mockLogger.Object
            }
        )!;

        return await task;
    }
}
