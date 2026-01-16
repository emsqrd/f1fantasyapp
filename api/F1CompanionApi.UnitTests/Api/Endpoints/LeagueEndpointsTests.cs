using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
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
    public async Task CreateLeagueAsync_UserProfileServiceThrows_ReturnsBadRequest()
    {
        // Arrange
        var request = new CreateLeagueRequest
        {
            Name = "Test League"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ThrowsAsync(new InvalidOperationException("User not found"));

        // Act
        var result = await InvokeCreateLeagueAsync(request);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
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
}
