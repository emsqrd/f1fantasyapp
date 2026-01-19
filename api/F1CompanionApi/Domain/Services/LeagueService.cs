using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ILeagueService
{
    Task<LeagueResponse> CreateLeagueAsync(CreateLeagueRequest createLeagueRequest, int ownerId);
    Task<IEnumerable<LeagueResponse>> GetLeaguesAsync();
    Task<IEnumerable<LeagueResponse>> GetAvailableLeaguesAsync(int userId, string? searchTerm = null);
    Task<LeagueDetailsResponse?> GetLeagueByIdAsync(int id);
    Task<IEnumerable<LeagueResponse>> GetLeaguesByOwnerIdAsync(int ownerId);
    Task<IEnumerable<LeagueResponse>> GetLeaguesForUserAsync(int userId);
    Task<LeagueResponse> JoinLeagueAsync(int leagueId, int userId);
}

public class LeagueService : ILeagueService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeagueService> _logger;

    public LeagueService(ApplicationDbContext dbContext, ILogger<LeagueService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<LeagueResponse> CreateLeagueAsync(
        CreateLeagueRequest createLeagueRequest,
        int ownerId
    )
    {
        _logger.LogDebug("Creating league {LeagueName} for owner {OwnerId}",
            createLeagueRequest.Name, ownerId);

        var owner = await _dbContext.UserProfiles.FindAsync(ownerId);
        if (owner is null)
        {
            _logger.LogError("Owner {OwnerId} not found when creating league", ownerId);
            throw new UserProfileNotFoundException(ownerId.ToString());
        }

        var newLeague = new League
        {
            Name = createLeagueRequest.Name,
            Description = createLeagueRequest.Description,
            IsPrivate = createLeagueRequest.IsPrivate,
            OwnerId = ownerId,
            CreatedBy = ownerId,
            CreatedAt = DateTime.UtcNow,
        };

        await _dbContext.Leagues.AddAsync(newLeague);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Successfully created league {LeagueId} with name {LeagueName} for owner {OwnerId}",
            newLeague.Id, newLeague.Name, ownerId);

        // Load the owner for mapping
        newLeague.Owner = owner;

        // Associate league owner's team with their new league
        var userTeam = await _dbContext.Teams.Where(x => x.UserId == ownerId).FirstOrDefaultAsync();

        if (userTeam is null)
        {
            _logger.LogError("No team found for Owner {OwnerId} when creating league", ownerId);
            throw new TeamNotFoundException(ownerId);
        }

        var leagueTeam = new LeagueTeam
        {
            LeagueId = newLeague.Id,
            TeamId = userTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = ownerId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.LeagueTeams.Add(leagueTeam);
        await _dbContext.SaveChangesAsync();

        return newLeague.ToResponseModel();
    }

    public async Task<IEnumerable<LeagueResponse>> GetLeaguesAsync()
    {
        _logger.LogDebug("Fetching all leagues");

        var leagues = await _dbContext.Leagues.Include(x => x.Owner).ToListAsync();

        _logger.LogDebug("Retrieved {LeagueCount} leagues", leagues.Count);

        return leagues.Select(league => league.ToResponseModel());
    }

    public async Task<IEnumerable<LeagueResponse>> GetAvailableLeaguesAsync(int userId, string? searchTerm = null)
    {
        _logger.LogDebug("Fetching all public leagues");

        // available = has capacity && user not already joined
        var query = _dbContext.Leagues
            .Include(x => x.Owner)
            .Include(x => x.LeagueTeams)
            .Where(x =>
                x.LeagueTeams.Count < x.MaxTeams &&
                !x.LeagueTeams.Any(lt => lt.Team.UserId == userId)
            );

        // apply search filter if provided
        if (!string.IsNullOrWhiteSpace(searchTerm))
        {
            var lowerSearchTerm = searchTerm.ToLower();

            query = query.Where(x =>
                x.Name.ToLower().Contains(lowerSearchTerm) ||
                (x.Description != null && x.Description.ToLower().Contains(lowerSearchTerm))
            );
        }

        var leagues = await query.ToListAsync();

        _logger.LogDebug("Retrieved {LeagueCount} public leagues", leagues.Count);

        return leagues.Select(league => league.ToResponseModel());
    }

    public async Task<LeagueDetailsResponse?> GetLeagueByIdAsync(int id)
    {
        _logger.LogDebug("Fetching league {LeagueId}", id);
        var league = await _dbContext.Leagues
                        .Include(x => x.Owner)
                        .Include(x => x.LeagueTeams)
                            .ThenInclude(lt => lt.Team)
                                .ThenInclude(t => t.Owner)
                        .FirstOrDefaultAsync(x => x.Id == id);

        if (league is null)
        {
            _logger.LogWarning("League {LeagueId} not found", id);
            return null;
        }

        return league.ToDetailsResponseModel();
    }

    public async Task<IEnumerable<LeagueResponse>> GetLeaguesByOwnerIdAsync(int ownerId)
    {
        _logger.LogDebug("Fetching leagues for owner {OwnerId}", ownerId);
        var leagues = await _dbContext.Leagues
            .Include(x => x.Owner)
            .Include(x => x.LeagueTeams)
            .Where(x => x.OwnerId == ownerId)
            .ToListAsync();
        _logger.LogDebug("Retrieved {LeagueCount} leagues for owner {OwnerId}", leagues.Count, ownerId);
        return leagues.Select(league => league.ToResponseModel());
    }

    //TODO: rename to something like GetUserJoinedLeagues or GetLeaguesJoinedByUser
    public async Task<IEnumerable<LeagueResponse>> GetLeaguesForUserAsync(int userId)
    {
        _logger.LogDebug("Fetching leagues for user {UserId}", userId);

        var leagues = await _dbContext.Leagues
            .Include(x => x.Owner)
            .Include(x => x.LeagueTeams)
            .Where(x => x.LeagueTeams.Any(lt => lt.Team.UserId == userId))
            .Distinct()
            .ToListAsync();

        _logger.LogDebug("Retrieved {LeagueCount} leagues for user {UserId}", leagues.Count, userId);

        return leagues.Select(league => league.ToResponseModel());
    }

    public async Task<LeagueResponse> JoinLeagueAsync(int leagueId, int userId)
    {
        // Input parameter guards

        if (leagueId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(leagueId), "League ID must be greater than 0");
        }

        if (userId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(userId), "User ID must be greater than 0");
        }

        // League validation
        _logger.LogDebug("User {UserId} attempting to join league {LeagueId}", userId, leagueId);

        var league = await _dbContext.Leagues
            .Include(x => x.LeagueTeams)
            .Include(x => x.Owner)
            .FirstOrDefaultAsync(x => x.Id == leagueId);

        if (league is null)
        {
            _logger.LogWarning("League {LeagueId} not found when user {UserId} attempted to join", leagueId, userId);
            throw new LeagueNotFoundException(leagueId);
        }

        if (league.IsPrivate)
        {
            _logger.LogWarning("User {UserId} attempted to join private league {LeagueId}", userId, leagueId);
            throw new LeagueIsPrivateException(leagueId);
        }

        if (league.LeagueTeams.Count >= league.MaxTeams)
        {
            _logger.LogWarning("User {UserId} attempted to join full league {LeagueId} (max: {MaxTeams})", userId, leagueId, league.MaxTeams);
            throw new LeagueFullException(leagueId, league.MaxTeams);
        }

        var userTeam = await _dbContext.Teams.FirstOrDefaultAsync(t => t.UserId == userId);

        if (userTeam is null)
        {
            _logger.LogWarning("No team found for user {UserId} when joining league {LeagueId}", userId, leagueId);
            throw new TeamNotFoundException(userId);
        }

        var existingMembership = league.LeagueTeams.FirstOrDefault(lt => lt.TeamId == userTeam.Id);

        if (existingMembership is not null)
        {
            _logger.LogWarning("Team {TeamId} is already in league {LeagueId}", userTeam.Id, leagueId);
            throw new AlreadyInLeagueException(leagueId, userTeam.Id);
        }

        var leagueTeam = new LeagueTeam
        {
            LeagueId = leagueId,
            TeamId = userTeam.Id,
            JoinedAt = DateTime.UtcNow,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };

        _dbContext.LeagueTeams.Add(leagueTeam);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("User {UserId} successfully joined league {LeagueId} with team {TeamId}", userId, leagueId, userTeam.Id);

        return league.ToResponseModel();
    }
}
