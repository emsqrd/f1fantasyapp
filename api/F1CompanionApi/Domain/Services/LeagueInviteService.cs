using System.Security.Cryptography;
using System.Text;
using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Extensions;
using Microsoft.AspNetCore.DataProtection;
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
    private readonly IDataProtector _protector;

    public LeagueInviteService(
        ApplicationDbContext dbContext,
        ILogger<LeagueInviteService> logger,
        IDataProtectionProvider dataProtectionProvider
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);
        ArgumentNullException.ThrowIfNull(dataProtectionProvider);

        _dbContext = dbContext;
        _logger = logger;

        // Create a "purpose" - isolates these tokens from other protected data
        _protector = dataProtectionProvider.CreateProtector("LeagueInvites");
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
        var existingInvite = await _dbContext.LeagueInvites.FirstOrDefaultAsync(x => x.LeagueId == leagueId);

        if (existingInvite != null)
        {
            return existingInvite.ToResponseModel();
        }

        // Create payload: combine leagueId and a unique guid
        var payload = $"{leagueId}:{Guid.NewGuid}";

        // Encrypt it
        var encryptedBytes = _protector.Protect(Encoding.UTF8.GetBytes(payload));

        var token = Base64UrlEncode(encryptedBytes);

        var leagueInvite = new LeagueInvite
        {
            LeagueId = leagueId,
            Token = token,
            CreatedBy = requesterId,
            CreatedAt = DateTime.UtcNow,
        };

        await _dbContext.LeagueInvites.AddAsync(leagueInvite);
        await _dbContext.SaveChangesAsync();

        return leagueInvite.ToResponseModel();
    }

    public async Task<LeagueInviteTokenPreviewResponse> ValidateAndPreviewLeagueInviteAsync(string token)
    {
        try
        {
            var leagueId = DecryptAndExtractLeagueId(token);

            // Fetch league and return preview
            var league = await _dbContext.Leagues
                .Include(x => x.Owner)
                .Include(x => x.LeagueTeams)
                .FirstOrDefaultAsync(x => x.Id == leagueId);

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
        catch (Exception ex) when (ex is CryptographicException
                                    or FormatException
                                    or OverflowException
                                    or IndexOutOfRangeException)
        {
            throw new InvalidLeagueInviteTokenException("Invalid token format");
        }
    }

    public async Task<LeagueResponse> JoinLeagueViaLeagueInviteAsync(string token, int userId)
    {
        // Input parameter guards
        if (userId <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(userId), "User ID must be greater than 0");
        }

        var leagueId = DecryptAndExtractLeagueId(token);
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

    private int DecryptAndExtractLeagueId(string token)
    {
        // Decode from URL-safe Base64
        var encryptedBytes = Base64UrlDecode(token);

        // Decrypt the token
        var decryptedBytes = _protector.Unprotect(encryptedBytes);
        var payload = Encoding.UTF8.GetString(decryptedBytes);

        // Extract leagueId from payload
        var parts = payload.Split(':');
        var leagueId = int.Parse(parts[0]);

        return leagueId;
    }

    private static string Base64UrlEncode(byte[] input)
    {
        var base64 = Convert.ToBase64String(input);

        // Mark URL-safe (Base64 with - and _ instead of + and /)
        return base64.Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        // Reverse the URL-safe encoding
        var base64 = input.Replace('-', '+').Replace('_', '/');

        // Add back padding
        switch (input.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }

        return Convert.FromBase64String(base64);
    }
}
