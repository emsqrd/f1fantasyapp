using F1CompanionApi.Api.Endpoints;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Api.Endpoints;

public class TeamEndpointsTests
{
    private readonly Mock<ILogger> _mockLogger;
    private readonly Mock<ITeamService> _mockTeamService;
    private readonly Mock<IUserProfileService> _mockUserProfileService;

    public TeamEndpointsTests()
    {
        _mockLogger = new Mock<ILogger>();
        _mockTeamService = new Mock<ITeamService>();
        _mockUserProfileService = new Mock<IUserProfileService>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetTeams_MultipleTeams_ReturnsAllTeams()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var teams = new List<Team>
        {
            new Team
            {
                Id = 1,
                Name = "Team Alpha",
            },
            new Team
            {
                Id = 2,
                Name = "Team Beta",
            },
            new Team
            {
                Id = 3,
                Name = "Team Gamma",
            }
        };

        context.Teams.AddRange(teams);
        await context.SaveChangesAsync();

        // Act
        var result = await InvokeGetTeams(context);

        // Assert
        Assert.NotNull(result);
        var teamList = result.ToList();
        Assert.Equal(3, teamList.Count);
        Assert.Contains(teamList, t => t.Name == "Team Alpha");
        Assert.Contains(teamList, t => t.Name == "Team Beta");
        Assert.Contains(teamList, t => t.Name == "Team Gamma");
    }

    [Fact]
    public async Task GetTeamByIdAsync_ExistingTeam_ReturnsTeam()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var owner = new UserProfile
        {
            Id = 1,
            AccountId = Guid.NewGuid().ToString(),
            Email = "owner@test.com",
            FirstName = "Test",
            LastName = "Owner"
        };
        var team = new Team
        {
            Id = 1,
            Name = "Findable Team",
            Owner = owner
        };

        context.UserProfiles.Add(owner);
        context.Teams.Add(team);
        await context.SaveChangesAsync();

        // Act
        var result = await InvokeGetTeamByIdAsync(team.Id, context);

        // Assert
        Assert.IsType<Ok<TeamDetailsResponse>>(result);
        var okResult = (Ok<TeamDetailsResponse>)result;
        Assert.Equal(team.Id, okResult.Value!.Id);
        Assert.Equal("Findable Team", okResult.Value.Name);
        Assert.Equal("Test Owner", okResult.Value.OwnerName);
        Assert.Empty(okResult.Value.Drivers);
        Assert.Empty(okResult.Value.Constructors);
    }

    [Fact]
    public async Task GetTeamByIdAsync_NonExistentTeam_ReturnsProblem()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        // Act
        var result = await InvokeGetTeamByIdAsync(999, context);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
    }

    [Fact]
    public async Task CreateTeamAsync_ValidRequest_ReturnsCreatedWithTeam()
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

        var request = new CreateTeamRequest
        {
            Name = "Test Team"
        };

        var teamResponse = new TeamResponse
        {
            Id = 1,
            Name = "Test Team",
            OwnerName = "John Doe"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.CreateTeamAsync(request, user.Id))
            .ReturnsAsync(teamResponse);

        // Act
        var result = await InvokeCreateTeamAsync(request);

        // Assert
        Assert.IsType<Created<TeamResponse>>(result);
        var createdResult = (Created<TeamResponse>)result;
        Assert.Equal($"/teams/{teamResponse.Id}", createdResult.Location);
        Assert.Equal(teamResponse, createdResult.Value);
    }

    [Fact]
    public async Task CreateTeamAsync_UserAlreadyHasTeam_ReturnsBadRequest()
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

        var request = new CreateTeamRequest
        {
            Name = "Test Team"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.CreateTeamAsync(request, user.Id))
            .ThrowsAsync(new InvalidOperationException("User already has a team"));

        // Act
        var result = await InvokeCreateTeamAsync(request);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("User already has a team", badRequestResult.Value);
    }

    [Fact]
    public async Task CreateTeamAsync_UserNotFound_ReturnsBadRequest()
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

        var request = new CreateTeamRequest
        {
            Name = "Test Team"
        };

        _mockUserProfileService
            .Setup(x => x.GetRequiredCurrentUserProfileAsync())
            .ReturnsAsync(user);

        _mockTeamService
            .Setup(x => x.CreateTeamAsync(request, user.Id))
            .ThrowsAsync(new InvalidOperationException("User not found"));

        // Act
        var result = await InvokeCreateTeamAsync(request);

        // Assert
        Assert.IsType<BadRequest<string>>(result);
        var badRequestResult = (BadRequest<string>)result;
        Assert.Equal("User not found", badRequestResult.Value);
    }

    [Fact]
    public async Task GetTeams_EmptyDatabase_ReturnsEmptyList()
    {
        // Arrange
        using var context = CreateInMemoryContext();

        // Act
        var result = await InvokeGetTeams(context);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(int.MaxValue)]
    public async Task GetTeamByIdAsync_BoundaryValues_ReturnsProblem(int id)
    {
        // Arrange
        using var context = CreateInMemoryContext();

        // Act
        var result = await InvokeGetTeamByIdAsync(id, context);

        // Assert
        Assert.IsType<ProblemHttpResult>(result);
        var problemResult = (ProblemHttpResult)result;
        Assert.Equal(StatusCodes.Status404NotFound, problemResult.StatusCode);
    }

    [Fact]
    public async Task GetTeamByIdAsync_TeamWithDriversAndConstructors_ReturnsCompleteData()
    {
        // Arrange
        using var context = CreateInMemoryContext();
        var owner = new UserProfile
        {
            Id = 1,
            AccountId = Guid.NewGuid().ToString(),
            Email = "owner@test.com",
            FirstName = "Test",
            LastName = "Owner"
        };

        var driver = new Driver
        {
            Id = 1,
            FirstName = "Lewis",
            LastName = "Hamilton",
            Abbreviation = "HAM",
            CountryAbbreviation = "GBR",
            IsActive = true
        };

        var constructor = new Constructor
        {
            Id = 1,
            Name = "Mercedes",
            FullName = "Mercedes-AMG Petronas F1 Team",
            CountryAbbreviation = "GER",
            IsActive = true
        };

        var team = new Team
        {
            Id = 1,
            Name = "Complete Team",
            Owner = owner,
            TeamDrivers = new List<TeamDriver>
            {
                new TeamDriver { DriverId = 1, Driver = driver, SlotPosition = 0 }
            },
            TeamConstructors = new List<TeamConstructor>
            {
                new TeamConstructor { ConstructorId = 1, Constructor = constructor, SlotPosition = 0 }
            }
        };

        context.UserProfiles.Add(owner);
        context.Drivers.Add(driver);
        context.Constructors.Add(constructor);
        context.Teams.Add(team);
        await context.SaveChangesAsync();

        // Act
        var result = await InvokeGetTeamByIdAsync(team.Id, context);

        // Assert
        Assert.IsType<Ok<TeamDetailsResponse>>(result);
        var okResult = (Ok<TeamDetailsResponse>)result;
        Assert.NotNull(okResult.Value);
        Assert.Equal(team.Id, okResult.Value.Id);
        Assert.Single(okResult.Value.Drivers);
        Assert.Single(okResult.Value.Constructors);
        Assert.Equal("HAM", okResult.Value.Drivers.First().Abbreviation);
        Assert.Equal("Mercedes", okResult.Value.Constructors.First().Name);
    }

    // Helper methods to invoke private endpoint methods via reflection
    private async Task<IEnumerable<Team>> InvokeGetTeams(ApplicationDbContext db)
    {
        var method = typeof(TeamEndpoints).GetMethod(
            "GetTeams",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IEnumerable<Team>>)method!.Invoke(
            null,
            new object[] { db, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeGetTeamByIdAsync(int id, ApplicationDbContext db)
    {
        var method = typeof(TeamEndpoints).GetMethod(
            "GetTeamByIdAsync",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static
        );

        var task = (Task<IResult>)method!.Invoke(
            null,
            new object[] { id, db, _mockLogger.Object }
        )!;

        return await task;
    }

    private async Task<IResult> InvokeCreateTeamAsync(CreateTeamRequest request)
    {
        var method = typeof(TeamEndpoints).GetMethod(
            "CreateTeamAsync",
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
}
