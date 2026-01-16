using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ITeamService
{
    Task<TeamResponse> CreateTeamAsync(CreateTeamRequest request, int userId);
    Task<TeamDetailsResponse?> GetUserTeamAsync(int userId);
    Task AddDriverToTeamAsync(int teamId, int driverId, int slotPosition, int userId);
    Task RemoveDriverFromTeamAsync(int teamId, int slotPosition, int userId);
    Task AddConstructorToTeamAsync(int teamId, int constructorId, int slotPosition, int userId);
    Task RemoveConstructorFromTeamAsync(int teamId, int slotPosition, int userId);
}

public class TeamService : ITeamService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<TeamService> _logger;

    public TeamService(
        ApplicationDbContext dbContext,
        ILogger<TeamService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<TeamResponse> CreateTeamAsync(CreateTeamRequest request, int userId)
    {
        _logger.LogInformation("Creating team for user {UserId}", userId);

        // Check if user already has a team
        var existingTeam = await _dbContext.Teams.FirstOrDefaultAsync(t => t.UserId == userId);

        if (existingTeam is not null)
        {
            _logger.LogWarning("User {UserId} already has a team {TeamId}", userId, existingTeam.Id);
            throw new DuplicateTeamException(userId, existingTeam.Id);
        }

        // Get user profile from owner name
        var user = await _dbContext.UserProfiles.FindAsync(userId);
        if (user is null)
        {
            _logger.LogError("User {UserId} not found", userId);
            throw new UserProfileNotFoundException(userId.ToString());
        }

        var team = new Team
        {
            Name = request.Name.Trim(),
            UserId = userId,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.Teams.Add(team);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Team {TeamId} created for user {UserId}", team.Id, userId);

        // Load the owner for mapping
        team.Owner = user;

        return team.ToResponseModel();
    }

    public async Task<TeamDetailsResponse?> GetUserTeamAsync(int userId)
    {
        _logger.LogDebug("Fetching team for user {UserId}", userId);

        var team = await _dbContext.Teams
            .Include(t => t.Owner)
            .Include(t => t.TeamDrivers)
                .ThenInclude(td => td.Driver)
            .Include(t => t.TeamConstructors)
                .ThenInclude(tc => tc.Constructor)
            .FirstOrDefaultAsync(t => t.UserId == userId);

        if (team is null)
        {
            _logger.LogWarning("Team not found for User {UserId}", userId);
            return null;
        }

        return team.ToDetailsResponseModel();
    }

    public async Task AddDriverToTeamAsync(int teamId, int driverId, int slotPosition, int userId)
    {
        _logger.LogInformation("Adding driver {DriverId} to team {TeamId} at slot {SlotPosition}", driverId, teamId, slotPosition);

        // Validate team ownership
        var team = await _dbContext.Teams
            .Include(t => t.TeamDrivers)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning("User {UserId} attempted to modify team {TeamId} owned by {OwnerId}", userId, teamId, team.UserId);
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        // Validate slot position range
        if (slotPosition < 0 || slotPosition > 4)
        {
            _logger.LogWarning("Invalid slot position {SlotPosition} for driver", slotPosition);
            throw new InvalidSlotPositionException(slotPosition, 4, "driver");
        }

        // Validate driver limit
        if (team.TeamDrivers.Count >= 5)
        {
            _logger.LogWarning("Team {TeamId} already has maximum drivers", teamId);
            throw new TeamFullException(teamId, 5, "driver");
        }

        // Check if slot is already occupied
        if (team.TeamDrivers.Any(td => td.SlotPosition == slotPosition))
        {
            _logger.LogWarning("Slot {SlotPosition} already occupied on team {TeamId}", slotPosition, teamId);
            throw new SlotOccupiedException(slotPosition, teamId);
        }

        // Check if driver already on team
        if (team.TeamDrivers.Any(td => td.DriverId == driverId))
        {
            _logger.LogWarning("Driver {DriverId} already on team {TeamId}", driverId, teamId);
            throw new EntityAlreadyOnTeamException(driverId, "driver", teamId);
        }

        // Verify driver exists
        var driver = await _dbContext.Drivers.FindAsync(driverId);
        if (driver is null)
        {
            _logger.LogWarning("Driver {DriverId} not found", driverId);
            throw new InvalidOperationException("Driver not found");
        }

        var teamDriver = new TeamDriver
        {
            TeamId = teamId,
            DriverId = driverId,
            SlotPosition = slotPosition,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TeamDrivers.Add(teamDriver);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Driver {DriverId} added to team {TeamId} at slot {SlotPosition}", driverId, teamId, slotPosition);
    }

    public async Task RemoveDriverFromTeamAsync(int teamId, int slotPosition, int userId)
    {
        _logger.LogInformation("Removing driver from team {TeamId} at slot {SlotPosition}", teamId, slotPosition);

        // Validate team ownership
        var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning("User {UserId} attempted to modify team {TeamId} owned by {OwnerId}", userId, teamId, team.UserId);
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        var teamDriver = await _dbContext.TeamDrivers
            .FirstOrDefaultAsync(td => td.TeamId == teamId && td.SlotPosition == slotPosition);

        if (teamDriver is null)
        {
            _logger.LogWarning("No driver found at slot {SlotPosition} on team {TeamId}", slotPosition, teamId);
            throw new InvalidOperationException($"No driver found at slot position {slotPosition}");
        }

        _dbContext.TeamDrivers.Remove(teamDriver);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Driver removed from team {TeamId} at slot {SlotPosition}", teamId, slotPosition);
    }

    public async Task AddConstructorToTeamAsync(int teamId, int constructorId, int slotPosition, int userId)
    {
        _logger.LogInformation("Adding constructor {ConstructorId} to team {TeamId} at slot {SlotPosition}", constructorId, teamId, slotPosition);

        // Validate team ownership
        var team = await _dbContext.Teams
            .Include(t => t.TeamConstructors)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning("User {UserId} attempted to modify team {TeamId} owned by {OwnerId}", userId, teamId, team.UserId);
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        // Validate slot position range
        if (slotPosition < 0 || slotPosition > 1)
        {
            _logger.LogWarning("Invalid slot position {SlotPosition} for constructor", slotPosition);
            throw new InvalidSlotPositionException(slotPosition, 1, "constructor");
        }

        // Validate constructor limit
        if (team.TeamConstructors.Count >= 2)
        {
            _logger.LogWarning("Team {TeamId} already has maximum constructors", teamId);
            throw new TeamFullException(teamId, 2, "constructor");
        }

        // Check if slot is already occupied
        if (team.TeamConstructors.Any(tc => tc.SlotPosition == slotPosition))
        {
            _logger.LogWarning("Slot {SlotPosition} already occupied on team {TeamId}", slotPosition, teamId);
            throw new SlotOccupiedException(slotPosition, teamId);
        }

        // Check if constructor already on team
        if (team.TeamConstructors.Any(tc => tc.ConstructorId == constructorId))
        {
            _logger.LogWarning("Constructor {ConstructorId} already on team {TeamId}", constructorId, teamId);
            throw new EntityAlreadyOnTeamException(constructorId, "constructor", teamId);
        }

        // Verify constructor exists
        var constructor = await _dbContext.Constructors.FindAsync(constructorId);
        if (constructor is null)
        {
            _logger.LogWarning("Constructor {ConstructorId} not found", constructorId);
            throw new InvalidOperationException("Constructor not found");
        }

        var teamConstructor = new TeamConstructor
        {
            TeamId = teamId,
            ConstructorId = constructorId,
            SlotPosition = slotPosition,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.TeamConstructors.Add(teamConstructor);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Constructor {ConstructorId} added to team {TeamId} at slot {SlotPosition}", constructorId, teamId, slotPosition);
    }

    public async Task RemoveConstructorFromTeamAsync(int teamId, int slotPosition, int userId)
    {
        _logger.LogInformation("Removing constructor from team {TeamId} at slot {SlotPosition}", teamId, slotPosition);

        // Validate team ownership
        var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning("User {UserId} attempted to modify team {TeamId} owned by {OwnerId}", userId, teamId, team.UserId);
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        var teamConstructor = await _dbContext.TeamConstructors
            .FirstOrDefaultAsync(tc => tc.TeamId == teamId && tc.SlotPosition == slotPosition);

        if (teamConstructor is null)
        {
            _logger.LogWarning("No constructor found at slot {SlotPosition} on team {TeamId}", slotPosition, teamId);
            throw new InvalidOperationException($"No constructor found at slot position {slotPosition}");
        }

        _dbContext.TeamConstructors.Remove(teamConstructor);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Constructor removed from team {TeamId} at slot {SlotPosition}", teamId, slotPosition);
    }
}
