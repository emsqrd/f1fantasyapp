using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ILeagueStandingsService
{
    Task UpdateStandingsForRaceWeekendAsync(int raceWeekendId);
    Task<IReadOnlyList<LeagueStanding>> GetStandingsAsync(int leagueId, int round);
    Task<IReadOnlyList<LeagueStanding>> GetPriorStandingsAsync(int leagueId, int round);
}

public class LeagueStandingsService : ILeagueStandingsService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeagueStandingsService> _logger;

    public LeagueStandingsService(
        ApplicationDbContext dbContext,
        ILogger<LeagueStandingsService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Updates league standings for the given race weekend.
    /// </summary>
    public async Task UpdateStandingsForRaceWeekendAsync(int raceWeekendId)
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
                .LeagueStandings.Where(ls =>
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
                var priorByTeam = priorStandings
                    .Where(p => p.LeagueId == leagueId)
                    .ToDictionary(p => p.TeamId);
                return StandingsRanker.Rank(
                    leagueId,
                    raceWeekendId,
                    scoresInLeague,
                    priorByTeam,
                    calculatedAt
                );
            })
            .ToList();

        await SaveStandingsAsync(leagueIds, raceWeekendId, newStandings);

        _logger.LogInformation(
            "Wrote {Count} league standing rows across {LeagueCount} leagues for race weekend {RaceWeekendId}",
            newStandings.Count,
            leagueIds.Count,
            raceWeekendId
        );
    }

    public async Task<IReadOnlyList<LeagueStanding>> GetStandingsAsync(int leagueId, int round)
    {
        return await _dbContext
            .LeagueStandings.Include(ls => ls.RaceWeekend)
            .Include(ls => ls.Team)
            .Where(ls => ls.LeagueId == leagueId && ls.RaceWeekend.Round == round)
            .OrderBy(ls => ls.Position)
            .ToListAsync();
    }

    public Task<IReadOnlyList<LeagueStanding>> GetPriorStandingsAsync(int leagueId, int round) =>
        round <= 1
            ? Task.FromResult<IReadOnlyList<LeagueStanding>>(Array.Empty<LeagueStanding>())
            : GetStandingsAsync(leagueId, round - 1);

    private async Task SaveStandingsAsync(
        IReadOnlyList<int> leagueIds,
        int raceWeekendId,
        IReadOnlyList<LeagueStanding> newStandings
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

    private async Task DeleteAndInsertLeagueStandingsAsync(
        IReadOnlyList<int> leagueIds,
        int raceWeekendId,
        IReadOnlyList<LeagueStanding> newStandings
    )
    {
        await _dbContext
            .LeagueStandings.Where(ls =>
                leagueIds.Contains(ls.LeagueId) && ls.RaceWeekendId == raceWeekendId
            )
            .ExecuteDeleteAsync();

        if (newStandings.Count > 0)
        {
            _dbContext.LeagueStandings.AddRange(newStandings);
            await _dbContext.SaveChangesAsync();
        }
    }
}
