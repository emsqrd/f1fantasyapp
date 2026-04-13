using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Constants;
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
    Task SetCaptainAsync(int teamId, int? driverId, int userId);
}

public class TeamService : ITeamService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<TeamService> _logger;

    public TeamService(ApplicationDbContext dbContext, ILogger<TeamService> logger)
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
            _logger.LogWarning(
                "User {UserId} already has a team {TeamId}",
                userId,
                existingTeam.Id
            );
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
            CreatedAt = DateTime.UtcNow,
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

        var team = await _dbContext
            .Teams.Include(t => t.Owner)
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

        var currentRaceWeekend = await GetCurrentRaceWeekendAsync();

        int? captainDriverId = currentRaceWeekend is null
            ? null
            : await _dbContext
                .LineupEntries.Where(le =>
                    le.TeamId == team.Id
                    && le.RaceWeekendId == currentRaceWeekend.Id
                    && le.EntityType == LineupEntityType.Driver
                    && le.IsCaptain
                )
                .Select(le => (int?)le.EntityId)
                .FirstOrDefaultAsync();

        return team.ToDetailsResponseModel(captainDriverId);
    }

    public async Task AddDriverToTeamAsync(int teamId, int driverId, int slotPosition, int userId)
    {
        _logger.LogInformation(
            "Adding driver {DriverId} to team {TeamId} at slot {SlotPosition}",
            driverId,
            teamId,
            slotPosition
        );

        var currentRaceWeekend = await GetCurrentRaceWeekendOrThrowIfLockedAsync();

        // Validate team ownership
        var team = await _dbContext
            .Teams.Include(t => t.TeamDrivers)
                .ThenInclude(td => td.Driver)
            .Include(t => t.TeamConstructors)
                .ThenInclude(tc => tc.Constructor)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning(
                "User {UserId} attempted to modify team {TeamId} owned by {OwnerId}",
                userId,
                teamId,
                team.UserId
            );
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        // Validate slot position range
        if (slotPosition < 0 || slotPosition > 3)
        {
            _logger.LogWarning("Invalid slot position {SlotPosition} for driver", slotPosition);
            throw new InvalidSlotPositionException(slotPosition, 3, "driver");
        }

        // Validate driver limit
        if (team.TeamDrivers.Count >= 4)
        {
            _logger.LogWarning("Team {TeamId} already has maximum drivers", teamId);
            throw new TeamFullException(teamId, 4, "driver");
        }

        // Check if slot is already occupied
        if (team.TeamDrivers.Any(td => td.SlotPosition == slotPosition))
        {
            _logger.LogWarning(
                "Slot {SlotPosition} already occupied on team {TeamId}",
                slotPosition,
                teamId
            );
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

        // Check budget cap
        var currentSpend =
            team.TeamDrivers.Sum(td => td.Driver.Price)
            + team.TeamConstructors.Sum(tc => tc.Constructor.Price);
        var projectedSpend = currentSpend + driver.Price;

        if (projectedSpend > BudgetConstants.BudgetCap)
            throw new BudgetExceededException(
                team.Id,
                driver.Price,
                BudgetConstants.BudgetCap - currentSpend
            );

        var teamDriver = new TeamDriver
        {
            TeamId = teamId,
            DriverId = driverId,
            SlotPosition = slotPosition,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _dbContext.TeamDrivers.Add(teamDriver);

        if (currentRaceWeekend is not null)
        {
            _dbContext.LineupEntries.Add(
                new LineupEntry
                {
                    TeamId = teamId,
                    RaceWeekendId = currentRaceWeekend.Id,
                    EntityId = driverId,
                    EntityType = LineupEntityType.Driver,
                    SlotPosition = slotPosition,
                    CreatedAt = DateTime.UtcNow,
                }
            );
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Driver {DriverId} added to team {TeamId} at slot {SlotPosition}",
            driverId,
            teamId,
            slotPosition
        );
    }

    public async Task RemoveDriverFromTeamAsync(int teamId, int slotPosition, int userId)
    {
        _logger.LogInformation(
            "Removing driver from team {TeamId} at slot {SlotPosition}",
            teamId,
            slotPosition
        );

        var currentRaceWeekend = await GetCurrentRaceWeekendOrThrowIfLockedAsync();

        // Validate team ownership
        var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning(
                "User {UserId} attempted to modify team {TeamId} owned by {OwnerId}",
                userId,
                teamId,
                team.UserId
            );
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        var teamDriver = await _dbContext.TeamDrivers.FirstOrDefaultAsync(td =>
            td.TeamId == teamId && td.SlotPosition == slotPosition
        );

        if (teamDriver is null)
        {
            _logger.LogWarning(
                "No driver found at slot {SlotPosition} on team {TeamId}",
                slotPosition,
                teamId
            );
            throw new InvalidOperationException($"No driver found at slot position {slotPosition}");
        }

        _dbContext.TeamDrivers.Remove(teamDriver);

        if (currentRaceWeekend is not null)
        {
            var entry = await _dbContext.LineupEntries.FirstOrDefaultAsync(le =>
                le.TeamId == teamId
                && le.RaceWeekendId == currentRaceWeekend.Id
                && le.EntityId == teamDriver.DriverId
                && le.EntityType == LineupEntityType.Driver
            );

            if (entry is not null)
                _dbContext.LineupEntries.Remove(entry);
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Driver removed from team {TeamId} at slot {SlotPosition}",
            teamId,
            slotPosition
        );
    }

    public async Task AddConstructorToTeamAsync(
        int teamId,
        int constructorId,
        int slotPosition,
        int userId
    )
    {
        _logger.LogInformation(
            "Adding constructor {ConstructorId} to team {TeamId} at slot {SlotPosition}",
            constructorId,
            teamId,
            slotPosition
        );

        var currentRaceWeekend = await GetCurrentRaceWeekendOrThrowIfLockedAsync();

        // Validate team ownership
        var team = await _dbContext
            .Teams.Include(t => t.TeamDrivers)
                .ThenInclude(td => td.Driver)
            .Include(t => t.TeamConstructors)
                .ThenInclude(tc => tc.Constructor)
            .FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning(
                "User {UserId} attempted to modify team {TeamId} owned by {OwnerId}",
                userId,
                teamId,
                team.UserId
            );
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        // Validate slot position range
        if (slotPosition < 0 || slotPosition > 3)
        {
            _logger.LogWarning(
                "Invalid slot position {SlotPosition} for constructor",
                slotPosition
            );
            throw new InvalidSlotPositionException(slotPosition, 3, "constructor");
        }

        // Validate constructor limit
        if (team.TeamConstructors.Count >= 4)
        {
            _logger.LogWarning("Team {TeamId} already has maximum constructors", teamId);
            throw new TeamFullException(teamId, 4, "constructor");
        }

        // Check if slot is already occupied
        if (team.TeamConstructors.Any(tc => tc.SlotPosition == slotPosition))
        {
            _logger.LogWarning(
                "Slot {SlotPosition} already occupied on team {TeamId}",
                slotPosition,
                teamId
            );
            throw new SlotOccupiedException(slotPosition, teamId);
        }

        // Check if constructor already at maximum (2) on team
        var constructorCount = team.TeamConstructors.Count(tc => tc.ConstructorId == constructorId);
        if (constructorCount >= 2)
        {
            _logger.LogWarning(
                "Constructor {ConstructorId} already at maximum (2) on team {TeamId}",
                constructorId,
                teamId
            );
            throw new EntityAlreadyOnTeamException(constructorId, "constructor", teamId);
        }

        // Verify constructor exists
        var constructor = await _dbContext.Constructors.FindAsync(constructorId);
        if (constructor is null)
        {
            _logger.LogWarning("Constructor {ConstructorId} not found", constructorId);
            throw new InvalidOperationException("Constructor not found");
        }

        // Check budget cap
        var currentSpend =
            team.TeamDrivers.Sum(td => td.Driver.Price)
            + team.TeamConstructors.Sum(tc => tc.Constructor.Price);
        var projectedSpend = currentSpend + constructor.Price;

        if (projectedSpend > BudgetConstants.BudgetCap)
            throw new BudgetExceededException(
                team.Id,
                constructor.Price,
                BudgetConstants.BudgetCap - currentSpend
            );

        var teamConstructor = new TeamConstructor
        {
            TeamId = teamId,
            ConstructorId = constructorId,
            SlotPosition = slotPosition,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _dbContext.TeamConstructors.Add(teamConstructor);

        if (currentRaceWeekend is not null)
        {
            _dbContext.LineupEntries.Add(
                new LineupEntry
                {
                    TeamId = teamId,
                    RaceWeekendId = currentRaceWeekend.Id,
                    EntityId = constructorId,
                    EntityType = LineupEntityType.Constructor,
                    SlotPosition = slotPosition,
                    CreatedAt = DateTime.UtcNow,
                }
            );
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Constructor {ConstructorId} added to team {TeamId} at slot {SlotPosition}",
            constructorId,
            teamId,
            slotPosition
        );
    }

    public async Task RemoveConstructorFromTeamAsync(int teamId, int slotPosition, int userId)
    {
        _logger.LogInformation(
            "Removing constructor from team {TeamId} at slot {SlotPosition}",
            teamId,
            slotPosition
        );

        var currentRaceWeekend = await GetCurrentRaceWeekendOrThrowIfLockedAsync();

        // Validate team ownership
        var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning(
                "User {UserId} attempted to modify team {TeamId} owned by {OwnerId}",
                userId,
                teamId,
                team.UserId
            );
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        var teamConstructor = await _dbContext.TeamConstructors.FirstOrDefaultAsync(tc =>
            tc.TeamId == teamId && tc.SlotPosition == slotPosition
        );

        if (teamConstructor is null)
        {
            _logger.LogWarning(
                "No constructor found at slot {SlotPosition} on team {TeamId}",
                slotPosition,
                teamId
            );
            throw new InvalidOperationException(
                $"No constructor found at slot position {slotPosition}"
            );
        }

        _dbContext.TeamConstructors.Remove(teamConstructor);

        if (currentRaceWeekend is not null)
        {
            var entry = await _dbContext.LineupEntries.FirstOrDefaultAsync(le =>
                le.TeamId == teamId
                && le.RaceWeekendId == currentRaceWeekend.Id
                && le.EntityId == teamConstructor.ConstructorId
                && le.EntityType == LineupEntityType.Constructor
            );

            if (entry is not null)
                _dbContext.LineupEntries.Remove(entry);
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Constructor removed from team {TeamId} at slot {SlotPosition}",
            teamId,
            slotPosition
        );
    }

    public async Task SetCaptainAsync(int teamId, int? driverId, int userId)
    {
        _logger.LogInformation(
            "User {UserId} setting captain to driver {DriverId} on team {TeamId}",
            userId,
            driverId,
            teamId
        );

        var currentRaceWeekend = await GetCurrentRaceWeekendOrThrowIfLockedAsync();

        var team = await _dbContext.Teams.FirstOrDefaultAsync(t => t.Id == teamId);

        if (team is null)
        {
            _logger.LogWarning("Team {TeamId} not found", teamId);
            throw new InvalidOperationException("Team not found");
        }

        if (team.UserId != userId)
        {
            _logger.LogWarning(
                "User {UserId} attempted to modify team {TeamId} owned by {OwnerId}",
                userId,
                teamId,
                team.UserId
            );
            throw new TeamOwnershipException(teamId, team.UserId, userId);
        }

        if (currentRaceWeekend is null)
        {
            _logger.LogWarning("No upcoming race — cannot set captain for team {TeamId}", teamId);
            throw new NoUpcomingRaceException();
        }

        LineupEntry? newCaptainEntry = null;

        if (driverId is not null)
        {
            newCaptainEntry = await _dbContext.LineupEntries.FirstOrDefaultAsync(le =>
                le.TeamId == teamId
                && le.RaceWeekendId == currentRaceWeekend.Id
                && le.EntityId == driverId
                && le.EntityType == LineupEntityType.Driver
            );

            if (newCaptainEntry is null)
            {
                _logger.LogWarning(
                    "Driver {DriverId} is not in the lineup for team {TeamId} race {RaceId}",
                    driverId,
                    teamId,
                    currentRaceWeekend.Id
                );
                throw new InvalidOperationException(
                    $"Driver {driverId} is not in the current lineup"
                );
            }
        }

        var existingCaptain = await _dbContext.LineupEntries.FirstOrDefaultAsync(le =>
            le.TeamId == teamId && le.RaceWeekendId == currentRaceWeekend.Id && le.IsCaptain
        );

        if (existingCaptain is not null)
            existingCaptain.IsCaptain = false;

        if (newCaptainEntry is not null)
            newCaptainEntry.IsCaptain = true;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Captain set to driver {DriverId} for team {TeamId} race {RaceId}",
            driverId,
            teamId,
            currentRaceWeekend.Id
        );
    }

    private async Task<RaceWeekend?> GetCurrentRaceWeekendAsync()
    {
        var now = DateTime.UtcNow;
        return await _dbContext
            .RaceWeekends.Where(r => r.RaceDate >= now)
            .OrderBy(r => r.RaceDate)
            .FirstOrDefaultAsync();
    }

    private async Task<RaceWeekend?> GetCurrentRaceWeekendOrThrowIfLockedAsync()
    {
        var currentRaceWeekend = await GetCurrentRaceWeekendAsync();

        var now = DateTime.UtcNow;
        if (currentRaceWeekend?.LockDeadline is not null && now >= currentRaceWeekend.LockDeadline)
            throw new RosterLockedException(
                currentRaceWeekend.Name,
                currentRaceWeekend.LockDeadline.Value
            );

        return currentRaceWeekend;
    }
}
