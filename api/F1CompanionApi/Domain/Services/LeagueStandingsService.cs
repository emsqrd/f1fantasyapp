using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ILeagueStandingsService
{
    Task UpdateLeagueStandingsForRaceWeekendAsync(int raceWeekendId);
    Task<LeagueStandingsResponse?> GetLeagueStandingsAsync(int leagueId);
    Task<IReadOnlyList<MyLeagueStandingResponse>> GetStandingsForUserAsync(int userId);
}

public class LeagueStandingsService : ILeagueStandingsService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ISeasonService _seasonService;
    private readonly ILogger<LeagueStandingsService> _logger;

    public LeagueStandingsService(
        ApplicationDbContext dbContext,
        ISeasonService seasonService,
        ILogger<LeagueStandingsService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(seasonService);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _seasonService = seasonService;
        _logger = logger;
    }

    /// <summary>
    /// Refreshes the leaderboards after a race weekend has been scored. Every league
    /// containing at least one team that earned points this weekend has its leaderboard
    /// for that round recalculated and saved.
    /// </summary>
    /// <param name="raceWeekendId">The race weekend whose scoring has just completed.</param>
    public async Task UpdateLeagueStandingsForRaceWeekendAsync(int raceWeekendId)
    {
        _logger.LogInformation(
            "Updating league standings for race weekend {RaceWeekendId}",
            raceWeekendId
        );

        var thisWeekend =
            await _dbContext.RaceWeekends.FirstOrDefaultAsync(r => r.Id == raceWeekendId)
            ?? throw new InvalidOperationException($"Race weekend {raceWeekendId} not found.");

        var thisRoundScores = await _dbContext
            .TeamRaceWeekendScores.AsNoTracking()
            .Where(s => s.RaceWeekendId == raceWeekendId)
            .ToListAsync();

        if (thisRoundScores.Count == 0)
        {
            _logger.LogInformation(
                "No team scores for race weekend {RaceWeekendId}",
                raceWeekendId
            );
            return;
        }

        var scoringTeamIds = thisRoundScores.Select(s => s.TeamId).ToList();
        var leagueIds = await _dbContext
            .LeagueTeams.Where(lt => scoringTeamIds.Contains(lt.TeamId))
            .Select(lt => lt.LeagueId)
            .Distinct()
            .ToListAsync();

        var priorWeekendId = await _dbContext
            .RaceWeekends.Where(r =>
                r.SeasonId == thisWeekend.SeasonId && r.Round == thisWeekend.Round - 1
            )
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();

        var priorStandings = priorWeekendId is null
            ? []
            : await _dbContext
                .TeamLeagueStandings.Where(ls =>
                    ls.RaceWeekendId == priorWeekendId && leagueIds.Contains(ls.LeagueId)
                )
                .ToListAsync();

        var leagueTeams = await _dbContext
            .LeagueTeams.AsNoTracking()
            .Where(lt => leagueIds.Contains(lt.LeagueId))
            .ToListAsync();

        var calculatedAt = DateTime.UtcNow;
        var newStandings = leagueIds
            .SelectMany(leagueId =>
            {
                var teamIds = leagueTeams
                    .Where(lt => lt.LeagueId == leagueId)
                    .Select(lt => lt.TeamId)
                    .ToHashSet();
                var scoresInLeague = thisRoundScores
                    .Where(s => teamIds.Contains(s.TeamId))
                    .ToList();
                var priorStandingByTeamId = priorStandings
                    .Where(p => p.LeagueId == leagueId)
                    .ToDictionary(p => p.TeamId);
                return StandingsRanker.Rank(
                    leagueId,
                    raceWeekendId,
                    scoresInLeague,
                    priorStandingByTeamId,
                    calculatedAt
                );
            })
            .ToList();

        await SaveLeagueStandingsAsync(leagueIds, raceWeekendId, newStandings);

        _logger.LogInformation(
            "Wrote {Count} league standing rows across {LeagueCount} leagues for race weekend {RaceWeekendId}",
            newStandings.Count,
            leagueIds.Count,
            raceWeekendId
        );
    }

    /// <summary>
    /// The current leaderboard for a league.
    /// </summary>
    /// <param name="leagueId">The league whose leaderboard is wanted.</param>
    public async Task<LeagueStandingsResponse?> GetLeagueStandingsAsync(int leagueId)
    {
        _logger.LogDebug("Fetching standings for league {LeagueId}", leagueId);

        var league = await _dbContext
            .Leagues.Include(l => l.LeagueTeams)
                .ThenInclude(lt => lt.Team)
                    .ThenInclude(t => t.Owner)
            .FirstOrDefaultAsync(l => l.Id == leagueId);

        if (league is null)
        {
            _logger.LogWarning("League {LeagueId} not found", leagueId);
            return null;
        }

        var currentSeason =
            await _seasonService.GetCurrentSeasonAsync()
            ?? throw new InvalidOperationException("No active season found.");

        var latestScoredWeekend = await _dbContext
            .TeamLeagueStandings.AsNoTracking()
            .Where(ls => ls.LeagueId == leagueId && ls.RaceWeekend.SeasonId == currentSeason.Id)
            .OrderByDescending(ls => ls.RaceWeekend.Round)
            .Select(ls => ls.RaceWeekend)
            .FirstOrDefaultAsync();

        IReadOnlyList<TeamLeagueStanding> currentStandings = [];
        IReadOnlyList<TeamLeagueStanding> priorStandings = [];
        if (latestScoredWeekend is not null)
        {
            (currentStandings, priorStandings) =
                await GetLeagueStandingsForCurrentAndPreviousRoundAsync(
                    leagueId,
                    latestScoredWeekend.Round
                );
        }

        return new LeagueStandingsResponse
        {
            LeagueId = leagueId,
            LastScoredRound = latestScoredWeekend?.Round,
            LastScoredRaceWeekendName = latestScoredWeekend?.Name,
            Standings = LeagueStandingsBuilder.Build(league, currentStandings, priorStandings),
        };
    }

    /// <summary>
    /// One row per league the caller's team belongs to, each carrying the caller's
    /// latest-round position and total in that league. Position and totals are null
    /// when the league has no scored round in the current season.
    /// </summary>
    /// <param name="userId">The authenticated user whose memberships are being summarized.</param>
    public async Task<IReadOnlyList<MyLeagueStandingResponse>> GetStandingsForUserAsync(int userId)
    {
        _logger.LogDebug("Fetching standings for user {UserId}", userId);

        var memberships = await _dbContext
            .LeagueTeams.AsNoTracking()
            .Include(lt => lt.League)
            .Where(lt => lt.Team.UserId == userId)
            .ToListAsync();

        if (memberships.Count == 0)
        {
            return [];
        }

        var teamId = memberships[0].TeamId;
        var leagueIds = memberships.Select(m => m.LeagueId).ToList();

        var totalTeamsByLeague = await _dbContext
            .LeagueTeams.Where(lt => leagueIds.Contains(lt.LeagueId))
            .GroupBy(lt => lt.LeagueId)
            .Select(g => new { LeagueId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.LeagueId, x => x.Count);

        var currentSeason =
            await _seasonService.GetCurrentSeasonAsync()
            ?? throw new InvalidOperationException("No active season found.");

        var latestByLeague = (
            await _dbContext
                .TeamLeagueStandings.AsNoTracking()
                .Include(ls => ls.RaceWeekend)
                .Where(ls =>
                    ls.TeamId == teamId
                    && leagueIds.Contains(ls.LeagueId)
                    && ls.RaceWeekend.SeasonId == currentSeason.Id
                )
                .ToListAsync()
        )
            .GroupBy(ls => ls.LeagueId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(s => s.RaceWeekend.Round).First());

        return memberships
            .Select(m =>
                m.ToResponseModel(
                    totalTeamsByLeague.GetValueOrDefault(m.LeagueId, 0),
                    latestByLeague.GetValueOrDefault(m.LeagueId)
                )
            )
            .ToList();
    }

    /// <summary>
    /// The league's leaderboard at a given race round paired with its leaderboard from
    /// the round before, used to compare how each team's position has shifted between
    /// the two races.
    /// </summary>
    /// <param name="leagueId">The league whose leaderboards are wanted.</param>
    /// <param name="currentRound">The round number of the more recent leaderboard; the round before it is paired alongside.</param>
    private async Task<(
        IReadOnlyList<TeamLeagueStanding> CurrentRoundStandings,
        IReadOnlyList<TeamLeagueStanding> PriorRoundStandings
    )> GetLeagueStandingsForCurrentAndPreviousRoundAsync(int leagueId, int currentRound)
    {
        var rounds = new[] { currentRound, currentRound - 1 };
        var standingsForBothRounds = await _dbContext
            .TeamLeagueStandings.AsNoTracking()
            .Include(ls => ls.RaceWeekend)
            .Include(ls => ls.Team)
            .Where(ls => ls.LeagueId == leagueId && rounds.Contains(ls.RaceWeekend.Round))
            .OrderBy(ls => ls.Position)
            .ToListAsync();

        var currentRoundStandings = standingsForBothRounds
            .Where(s => s.RaceWeekend.Round == currentRound)
            .ToList();
        var priorRoundStandings = standingsForBothRounds
            .Where(s => s.RaceWeekend.Round == currentRound - 1)
            .ToList();
        return (currentRoundStandings, priorRoundStandings);
    }

    /// <summary>
    /// Atomically replaces the saved leaderboard rows for a race weekend across the
    /// given leagues. Readers see either the previous version or the new one,
    /// never a partial mix.
    /// </summary>
    /// <param name="leagueIds">The leagues whose leaderboards are being updated.</param>
    /// <param name="raceWeekendId">The race weekend whose rows are being replaced.</param>
    /// <param name="newStandings">The fresh leaderboard rows to save.</param>
    private async Task SaveLeagueStandingsAsync(
        IReadOnlyList<int> leagueIds,
        int raceWeekendId,
        IReadOnlyList<TeamLeagueStanding> newStandings
    )
    {
        // Wrap delete + insert in a transaction so the save is atomic. The retry-enabled
        // execution strategy requires the whole transaction to run as a retriable unit.
        var strategy = _dbContext.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _dbContext.Database.BeginTransactionAsync();
            await DeleteAndInsertLeagueStandingsAsync(leagueIds, raceWeekendId, newStandings);
            await transaction.CommitAsync();
        });
    }

    /// <summary>
    /// Clears any existing leaderboard rows for this race weekend in the given leagues
    /// and saves the fresh rows in their place.
    /// </summary>
    /// <param name="leagueIds">The leagues whose leaderboards are being replaced.</param>
    /// <param name="raceWeekendId">The race weekend whose rows are being replaced.</param>
    /// <param name="newStandings">The fresh leaderboard rows to save.</param>
    private async Task DeleteAndInsertLeagueStandingsAsync(
        IReadOnlyList<int> leagueIds,
        int raceWeekendId,
        IReadOnlyList<TeamLeagueStanding> newStandings
    )
    {
        await _dbContext
            .TeamLeagueStandings.Where(ls =>
                leagueIds.Contains(ls.LeagueId) && ls.RaceWeekendId == raceWeekendId
            )
            .ExecuteDeleteAsync();

        if (newStandings.Count > 0)
        {
            _dbContext.TeamLeagueStandings.AddRange(newStandings);
            await _dbContext.SaveChangesAsync();
        }
    }
}
