using System.Security.Cryptography;
using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Extensions;
using Microsoft.EntityFrameworkCore;
using Sentry.Protocol;

namespace F1CompanionApi.Domain.Services;

public interface ILeagueInviteService
{
    Task<LeagueInviteTokenResponse> GetOrCreateLeagueInviteAsync(int leagueId, int requestorId);
    Task<LeagueInviteTokenPreviewResponse> ValidateAndPreviewLeagueInviteAsync(string token);
    Task<LeagueResponse> JoinLeagueViaLeagueInviteAsync(string token, int userId);
}

public class LeagueInviteService : ILeagueInviteService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeagueInviteService> _logger;

    public LeagueInviteService(
        ApplicationDbContext dbContext,
        ILogger<LeagueInviteService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<LeagueInviteTokenResponse> GetOrCreateLeagueInviteAsync(int leagueId, int requesterId)
    {
        var league = await _dbContext.Leagues.FindAsync(leagueId);
        if (league is null)
        {
            throw new LeagueNotFoundException(leagueId);
        }

        if (league.OwnerId != requesterId)
        {
            throw new UnauthorizedAccessException("Only league owner can create invites");
        }

        if (!league.IsPrivate)
        {
            throw new InvalidOperationException("Public leagues cannot be joined by league invite");
        }

        // Check if invite already exists
        var existingInvite = await _dbContext.LeagueInvites
            .Include(x => x.CreatedByUser)
            .FirstOrDefaultAsync(x => x.LeagueId == leagueId);

        if (existingInvite != null)
        {
            return existingInvite.ToResponseModel();
        }

        // Generate unique token (retry on collision)
        string token;
        int attempts = 0;
        const int maxAttempts = 5;

        do
        {
            token = GenerateSecureRandomCode(10);
            attempts++;

            if (attempts >= maxAttempts)
            {
                throw new InvalidOperationException("Failed to generate unique invite token");
            }
        }
        while (await _dbContext.LeagueInvites.AnyAsync(x => x.Token == token));

        var leagueInvite = new LeagueInvite
        {
            LeagueId = leagueId,
            Token = token,
            CreatedBy = requesterId,
            CreatedAt = DateTime.UtcNow,
        };

        await _dbContext.LeagueInvites.AddAsync(leagueInvite);
        await _dbContext.SaveChangesAsync();

        // Load CreatedByUser navigation property for ToResponseModel()
        await _dbContext.Entry(leagueInvite).Reference(x => x.CreatedByUser).LoadAsync();

        return leagueInvite.ToResponseModel();
    }

    public async Task<LeagueInviteTokenPreviewResponse> ValidateAndPreviewLeagueInviteAsync(string token)
    {
        var invite = await _dbContext.LeagueInvites
            .Include(x => x.League)
                .ThenInclude(l => l.Owner)
            .Include(x => x.League)
                .ThenInclude(l => l.LeagueTeams)
            .FirstOrDefaultAsync(x => x.Token == token);

        if (invite == null)
        {
            throw new InvalidLeagueInviteTokenException("Invalid or expired invite");
        }

        var league = invite.League;
        if (league == null)
        {
            throw new InvalidLeagueInviteTokenException("League not found");
        }

        return new LeagueInviteTokenPreviewResponse
        {
            LeagueName = league.Name,
            LeagueDescription = league.Description,
            OwnerName = league.Owner.GetFullName(),
            CurrentTeamCount = league.LeagueTeams.Count,
            MaxTeams = league.MaxTeams,
            IsLeagueFull = league.LeagueTeams.Count >= league.MaxTeams
        };
    }

    public async Task<LeagueResponse> JoinLeagueViaLeagueInviteAsync(string token, int userId)
    {
        // Input parameter guards
        if (userId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(userId), "User ID must be greater than 0");
        }

        var invite = await _dbContext.LeagueInvites
            .FirstOrDefaultAsync(x => x.Token == token);

        if (invite == null)
        {
            throw new InvalidLeagueInviteTokenException("Invalid or expired invite");
        }

        var leagueId = invite.LeagueId;
        var league = await _dbContext.Leagues
            .Include(x => x.Owner)
            .Include(x => x.LeagueTeams)
            .FirstOrDefaultAsync(x => x.Id == leagueId);

        if (league is null)
        {
            throw new LeagueNotFoundException(leagueId);
        }

        _logger.LogDebug("User {UserId} attempting to join league {leagueId}", userId, leagueId);

        var isLeagueFull = league.LeagueTeams.Count >= league.MaxTeams;
        if (isLeagueFull)
        {
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

        _logger.LogInformation("User {UserId} successfully joined League {LeagueId} with team {TeamId}", userId, leagueId, userTeam.Id);

        return league.ToResponseModel();
    }

    private static string GenerateSecureRandomCode(int length = 10)
    {
        // Use only URL-safe characters (avoid confusion: no 0, O, I, l)
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz";

        var bytes = new byte[length];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);

        var result = new char[length];
        for (int i = 0; i < length; i++)
        {
            result[i] = chars[bytes[i] % chars.Length];
        }

        return new string(result);
    }
}
