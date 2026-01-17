using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class MeEndpointsTests
{
    private readonly Mock<ISupabaseAuthService> _mockAuthService;
    private readonly Mock<IUserProfileService> _mockUserProfileService;
    private readonly Mock<ILeagueService> _mockLeagueService;
    private readonly Mock<ITeamService> _mockTeamService;
    private readonly Mock<HttpContext> _mockHttpContext;
    private readonly Mock<ILogger> _mockLogger;

    public MeEndpointsTests()
    {
        _mockAuthService = new Mock<ISupabaseAuthService>();
        _mockUserProfileService = new Mock<IUserProfileService>();
        _mockLeagueService = new Mock<ILeagueService>();
        _mockTeamService = new Mock<ITeamService>();
        _mockHttpContext = new Mock<HttpContext>();
        _mockLogger = new Mock<ILogger>();
    }

    [Theory]
    [InlineData("Test User")]
    [InlineData(null)]
    public async Task RegisterUserAsync_ValidRequest_ReturnsCreatedWithProfile(string? displayName)
    {
        // Arrange
        var userId = "test-user-id";
        var userEmail = "test@test.com";

        var request = new MeEndpoints.RegisterUserRequest(displayName);

        var createdProfile = new UserProfileResponse
        {
            Id = 1,
            Email = userEmail,
            DisplayName = displayName,
            CreatedAt = DateTime.UtcNow
        };

        _mockAuthService
            .Setup(x => x.GetRequiredUserId())
            .Returns(userId);

        _mockAuthService
            .Setup(x => x.GetUserEmail())
            .Returns(userEmail);

        _mockUserProfileService
            .Setup(x => x.GetUserProfileByAccountIdAsync(userId))
            .ReturnsAsync((UserProfileResponse?)null);

        _mockUserProfileService
            .Setup(x => x.CreateUserProfileAsync(userId, userEmail, displayName))
            .ReturnsAsync(createdProfile);

        // Act
        var result = await InvokeRegisterUserAsync(request);

        // Assert
        Assert.IsType<Created<UserProfileResponse>>(result);
        var createdResult = (Created<UserProfileResponse>)result;
        Assert.Equal("/me/profile", createdResult.Location);
        Assert.Equal(createdProfile, createdResult.Value);
    }

    [Fact]
    public async Task RegisterUserAsync_UserEmailIsNull_ReturnsBadRequest()
    {
        // Arrange
        var userId = "test-user-id";
        var request = new MeEndpoints.RegisterUserRequest("Test User");

        _mockAuthService
            .Setup(x => x.GetRequiredUserId())
            .Returns(userId);

        _mockAuthService
            .Setup(x => x.GetUserEmail())
            .Returns((string?)null);

        // Act
        var result = await InvokeRegisterUserAsync(request);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task RegisterUserAsync_UserAlreadyRegistered_ReturnsConflict()
    {
        // Arrange
        var userId = "test-user-id";
        var userEmail = "test@test.com";
        var request = new MeEndpoints.RegisterUserRequest("Test User");

        var existingProfile = new UserProfileResponse
        {
            Id = 1,
            Email = userEmail,
            CreatedAt = DateTime.UtcNow
        };

        _mockAuthService
            .Setup(x => x.GetRequiredUserId())
            .Returns(userId);

        _mockAuthService
            .Setup(x => x.GetUserEmail())
            .Returns(userEmail);

        _mockUserProfileService
            .Setup(x => x.GetUserProfileByAccountIdAsync(userId))
            .ReturnsAsync(existingProfile);

        // Act
        var result = await InvokeRegisterUserAsync(request);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status409Conflict, problemResult.StatusCode);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_ValidRequest_ReturnsOkWithUpdatedProfile()
    {
        // Arrange
        var existingProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            DisplayName = "Old Name",
            CreatedAt = DateTime.UtcNow
        };

        var updateRequest = new UpdateUserProfileRequest
        {
            Id = 1,
            DisplayName = "New Name",
            FirstName = "John",
            LastName = "Doe"
        };

        var updatedResponse = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            DisplayName = "New Name",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetCurrentUserProfileAsync())
            .ReturnsAsync(existingProfile);

        _mockUserProfileService
            .Setup(x => x.UpdateUserProfileAsync(updateRequest))
            .ReturnsAsync(updatedResponse);

        // Act
        var result = await InvokeUpdateUserProfileAsync(updateRequest);

        // Assert
        Assert.IsType<Ok<UserProfileResponse>>(result);
        var okResult = (Ok<UserProfileResponse>)result;
        Assert.Equal(updatedResponse, okResult.Value);
    }

    [Fact]
    public async Task UpdateUserProfileAsync_UserProfileNotFound_ReturnsNotFound()
    {
        // Arrange
        var updateRequest = new UpdateUserProfileRequest
        {
            Id = 1,
            DisplayName = "New Name"
        };

        _mockUserProfileService
            .Setup(x => x.GetCurrentUserProfileAsync())
            .ReturnsAsync((UserProfileResponse?)null);

        // Act
        var result = await InvokeUpdateUserProfileAsync(updateRequest);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetMyLeaguesAsync_UserHasLeagues_ReturnsOkWithLeagues()
    {
        // Arrange
        var userProfileResponse = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

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
                Description = "Description 2",
                OwnerName = "John Doe",
                MaxTeams = 20,
                IsPrivate = false
            }
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfileResponse);

        _mockLeagueService
            .Setup(x => x.GetLeaguesByOwnerIdAsync(userProfileResponse.Id))
            .ReturnsAsync(leagues);

        // Act
        var result = await InvokeGetMyLeaguesAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        var leagueList = okResult.Value!.ToList();
        Assert.Equal(2, leagueList.Count);
        Assert.Equal("League 1", leagueList[0].Name);
        Assert.Equal("John Doe", leagueList[0].OwnerName);
        Assert.Equal("League 2", leagueList[1].Name);
        Assert.Equal(20, leagueList[1].MaxTeams);
    }

    [Fact]
    public async Task GetMyLeaguesAsync_UserHasNoLeagues_ReturnsOkWithEmptyCollection()
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

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        _mockLeagueService
            .Setup(x => x.GetLeaguesByOwnerIdAsync(userProfile.Id))
            .ReturnsAsync(new List<LeagueResponse>());

        // Act
        var result = await InvokeGetMyLeaguesAsync();

        // Assert
        Assert.IsType<Ok<IEnumerable<LeagueResponse>>>(result);
        var okResult = (Ok<IEnumerable<LeagueResponse>>)result;
        Assert.NotNull(okResult.Value);
        Assert.Empty(okResult.Value);
    }

    [Fact]
    public async Task GetMyLeaguesAsync_ServiceThrowsException_ReturnsBadRequest()
    {
        // Arrange
        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ThrowsAsync(new InvalidOperationException("User not found"));

        // Act
        var result = await InvokeGetMyLeaguesAsync();

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetMyTeamAsync_UserHasTeam_ReturnsOkWithTeam()
    {
        // Arrange
        var user = new UserProfileResponse
        {
            Id = 1,
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        var teamResponse = new TeamDetailsResponse
        {
            Id = 1,
            Name = "My Team",
            OwnerName = "John Doe",
            Drivers = new List<TeamDriverResponse>(),
            Constructors = new List<TeamConstructorResponse>()
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(teamResponse);

        // Act
        var result = await InvokeGetMyTeamAsync();

        // Assert
        Assert.IsType<Ok<TeamDetailsResponse>>(result);
        var okResult = (Ok<TeamDetailsResponse>)result;
        Assert.Equal(teamResponse, okResult.Value);
        Assert.Equal("My Team", okResult.Value!.Name);
    }

    [Fact]
    public async Task GetMyTeamAsync_UserHasNoTeam_ReturnsOkWithNull()
    {
        // Arrange
        var user = new UserProfileResponse
        {
            Id = 1,
            Email = "user@test.com",
            FirstName = "John",
            LastName = "Doe",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync((TeamDetailsResponse?)null);

        // Act
        var result = await InvokeGetMyTeamAsync();

        // Assert
        Assert.IsType<Ok>(result);
    }

    [Fact]
    public async Task GetUserProfileAsync_UserExists_ReturnsOkWithProfile()
    {
        // Arrange
        var userProfile = new UserProfileResponse
        {
            Id = 1,
            Email = "test@test.com",
            DisplayName = "Test User",
            CreatedAt = DateTime.UtcNow
        };

        _mockUserProfileService
            .Setup(x => x.GetCurrentUserProfileAsync())
            .ReturnsAsync(userProfile);

        // Act
        var result = await InvokeGetUserProfileAsync();

        // Assert
        Assert.IsType<Ok<UserProfileResponse>>(result);
        var okResult = (Ok<UserProfileResponse>)result;
        Assert.Equal(userProfile, okResult.Value);
    }

    [Fact]
    public async Task GetUserProfileAsync_UserNotFound_ReturnsNotFound()
    {
        // Arrange
        _mockUserProfileService
            .Setup(x => x.GetCurrentUserProfileAsync())
            .ReturnsAsync((UserProfileResponse?)null);

        // Act
        var result = await InvokeGetUserProfileAsync();

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_Success_ReturnsNoContent()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        var request = new AddDriverToTeamRequest { DriverId = 5, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.AddDriverToTeamAsync(team.Id, request.DriverId, request.SlotPosition, user.Id))
            .Returns(Task.CompletedTask);

        // Act
        var result = await InvokeAddDriverToTeamAsync(request);

        // Assert
        Assert.IsType<NoContent>(result);
        _mockTeamService.Verify(x => x.AddDriverToTeamAsync(team.Id, request.DriverId, request.SlotPosition, user.Id), Times.Once);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_UserHasNoTeam_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var request = new AddDriverToTeamRequest { DriverId = 5, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync((TeamDetailsResponse?)null);

        // Act
        var result = await InvokeAddDriverToTeamAsync(request);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task AddDriverToTeamAsync_ServiceThrowsInvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        var request = new AddDriverToTeamRequest { DriverId = 5, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.AddDriverToTeamAsync(team.Id, request.DriverId, request.SlotPosition, user.Id))
            .ThrowsAsync(new InvalidOperationException("Slot already occupied"));

        // Act
        var result = await InvokeAddDriverToTeamAsync(request);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("Slot already occupied", badRequestResult.Value);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_Success_ReturnsNoContent()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.RemoveDriverFromTeamAsync(team.Id, slotPosition, user.Id))
            .Returns(Task.CompletedTask);

        // Act
        var result = await InvokeRemoveDriverFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<NoContent>(result);
        _mockTeamService.Verify(x => x.RemoveDriverFromTeamAsync(team.Id, slotPosition, user.Id), Times.Once);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_UserHasNoTeam_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync((TeamDetailsResponse?)null);

        // Act
        var result = await InvokeRemoveDriverFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task RemoveDriverFromTeamAsync_ServiceThrowsInvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.RemoveDriverFromTeamAsync(team.Id, slotPosition, user.Id))
            .ThrowsAsync(new InvalidOperationException("Slot is empty"));

        // Act
        var result = await InvokeRemoveDriverFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("Slot is empty", badRequestResult.Value);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_Success_ReturnsNoContent()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        var request = new AddConstructorToTeamRequest { ConstructorId = 3, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.AddConstructorToTeamAsync(team.Id, request.ConstructorId, request.SlotPosition, user.Id))
            .Returns(Task.CompletedTask);

        // Act
        var result = await InvokeAddConstructorToTeamAsync(request);

        // Assert
        Assert.IsType<NoContent>(result);
        _mockTeamService.Verify(x => x.AddConstructorToTeamAsync(team.Id, request.ConstructorId, request.SlotPosition, user.Id), Times.Once);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_UserHasNoTeam_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var request = new AddConstructorToTeamRequest { ConstructorId = 3, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync((TeamDetailsResponse?)null);

        // Act
        var result = await InvokeAddConstructorToTeamAsync(request);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task AddConstructorToTeamAsync_ServiceThrowsInvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        var request = new AddConstructorToTeamRequest { ConstructorId = 3, SlotPosition = 1 };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.AddConstructorToTeamAsync(team.Id, request.ConstructorId, request.SlotPosition, user.Id))
            .ThrowsAsync(new InvalidOperationException("Constructor slot already occupied"));

        // Act
        var result = await InvokeAddConstructorToTeamAsync(request);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("Constructor slot already occupied", badRequestResult.Value);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_Success_ReturnsNoContent()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.RemoveConstructorFromTeamAsync(team.Id, slotPosition, user.Id))
            .Returns(Task.CompletedTask);

        // Act
        var result = await InvokeRemoveConstructorFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<NoContent>(result);
        _mockTeamService.Verify(x => x.RemoveConstructorFromTeamAsync(team.Id, slotPosition, user.Id), Times.Once);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_UserHasNoTeam_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync((TeamDetailsResponse?)null);

        // Act
        var result = await InvokeRemoveConstructorFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status400BadRequest, problemResult.StatusCode);
    }

    [Fact]
    public async Task RemoveConstructorFromTeamAsync_ServiceThrowsInvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var user = new UserProfileResponse { Id = 1, Email = "test@test.com", CreatedAt = DateTime.UtcNow };
        var team = new TeamDetailsResponse { Id = 10, Name = "Team", OwnerName = "User", Drivers = new List<TeamDriverResponse>(), Constructors = new List<TeamConstructorResponse>() };
        int slotPosition = 1;

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.GetUserTeamAsync(user.Id))
            .ReturnsAsync(team);

        _mockTeamService
            .Setup(x => x.RemoveConstructorFromTeamAsync(team.Id, slotPosition, user.Id))
            .ThrowsAsync(new InvalidOperationException("Constructor slot is empty"));

        // Act
        var result = await InvokeRemoveConstructorFromTeamAsync(slotPosition);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("Constructor slot is empty", badRequestResult.Value);
    }

    // Helper methods to invoke private endpoint methods via reflection
    private async Task<IResult> InvokeRegisterUserAsync(MeEndpoints.RegisterUserRequest request)
    {
        var method = typeof(MeEndpoints).GetMethod(
            "RegisterUserAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockHttpContext.Object,
                _mockAuthService.Object,
                _mockUserProfileService.Object,
                request,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeUpdateUserProfileAsync(
        UpdateUserProfileRequest updateRequest
    )
    {
        var method = typeof(MeEndpoints).GetMethod(
            "UpdateUserProfileAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockHttpContext.Object,
                _mockAuthService.Object,
                _mockUserProfileService.Object,
                updateRequest,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetMyLeaguesAsync()
    {
        var method = typeof(MeEndpoints).GetMethod(
            "GetMyLeaguesAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockUserProfileService.Object,
                _mockLeagueService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetMyTeamAsync()
    {
        var method = typeof(MeEndpoints).GetMethod(
            "GetMyTeamAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockTeamService.Object,
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetUserProfileAsync()
    {
        var method = typeof(MeEndpoints).GetMethod(
            "GetUserProfileAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeAddDriverToTeamAsync(AddDriverToTeamRequest request)
    {
        var method = typeof(MeEndpoints).GetMethod(
            "AddDriverToTeamAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                request,
                _mockTeamService.Object,
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeRemoveDriverFromTeamAsync(int slotPosition)
    {
        var method = typeof(MeEndpoints).GetMethod(
            "RemoveDriverFromTeamAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                slotPosition,
                _mockTeamService.Object,
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeAddConstructorToTeamAsync(AddConstructorToTeamRequest request)
    {
        var method = typeof(MeEndpoints).GetMethod(
            "AddConstructorToTeamAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                request,
                _mockTeamService.Object,
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeRemoveConstructorFromTeamAsync(int slotPosition)
    {
        var method = typeof(MeEndpoints).GetMethod(
            "RemoveConstructorFromTeamAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[]
            {
                slotPosition,
                _mockTeamService.Object,
                _mockUserProfileService.Object,
                _mockLogger.Object
            }
        )!;

        return await task;
    }
}
