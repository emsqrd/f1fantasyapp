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
    private readonly Mock<HttpContext> _mockHttpContext;
    private readonly Mock<ILogger> _mockLogger;

    public LeagueEndpointsTests()
    {
        _mockAuthService = new Mock<ISupabaseAuthService>();
        _mockUserProfileService = new Mock<IUserProfileService>();
        _mockLeagueService = new Mock<ILeagueService>();
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
    public async Task GetPublicLeaguesAsync_WithoutSearchTerm_ReturnsOkWithLeagues()
    {
        // Arrange
        var publicLeagues = new List<LeagueResponse>
        {
            new LeagueResponse
            {
                Id = 1,
                Name = "Public League 1",
                OwnerName = "John Doe",
                MaxTeams = 15,
                IsPrivate = false
            },
            new LeagueResponse
            {
                Id = 2,
                Name = "Public League 2",
                OwnerName = "Jane Smith",
                MaxTeams = 20,
                IsPrivate = false
            }
        };

        _mockLeagueService
            .Setup(x => x.GetPublicLeaguesAsync(null))
            .ReturnsAsync(publicLeagues);

        // Act
        var result = await InvokeGetPublicLeaguesAsync(null);

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(publicLeagues, okResult.Value);
        _mockLeagueService.Verify(x => x.GetPublicLeaguesAsync(null), Times.Once);
    }

    [Fact]
    public async Task GetPublicLeaguesAsync_WithSearchTerm_ReturnsOkWithLeagues()
    {
        // Arrange
        var searchTerm = "Championship";
        var filteredLeagues = new List<LeagueResponse>
        {
            new LeagueResponse
            {
                Id = 3,
                Name = "World Championship League",
                OwnerName = "Admin User",
                MaxTeams = 30,
                IsPrivate = false
            }
        };

        _mockLeagueService
            .Setup(x => x.GetPublicLeaguesAsync(searchTerm))
            .ReturnsAsync(filteredLeagues);

        // Act
        var result = await InvokeGetPublicLeaguesAsync(searchTerm);

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(filteredLeagues, okResult.Value);
        _mockLeagueService.Verify(x => x.GetPublicLeaguesAsync(searchTerm), Times.Once);
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
            "GetPublicLeaguesAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object?[] { _mockLeagueService.Object, searchTerm, _mockLogger.Object }
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
}
