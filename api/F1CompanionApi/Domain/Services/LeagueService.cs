using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace F1CompanionApi.Domain.Services;

public interface ILeagueService
{
    Task<LeagueResponse> CreateLeagueAsync(
        CreateLeagueRequest createLeagueRequest,
        int ownerId
    );
    Task<IEnumerable<LeagueResponse>> GetLeaguesAsync();
    Task<LeagueDetailsResponse?> GetLeagueByIdAsync(int id);
    Task<IEnumerable<LeagueResponse>> GetLeaguesByOwnerIdAsync(int ownerId);
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
            .Where(x => x.OwnerId == ownerId)
            .ToListAsync();
        _logger.LogDebug("Retrieved {LeagueCount} leagues for owner {OwnerId}", leagues.Count, ownerId);
        return leagues.Select(league => league.ToResponseModel());
    }
}
