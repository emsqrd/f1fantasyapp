using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IRaceWeekendService
{
    Task<IEnumerable<RaceWeekendResponse>> GetRaceWeekendsBySeasonAsync(int seasonId);
    Task<RaceWeekendResponse?> GetRaceWeekendByRoundAsync(int seasonId, int round);
    Task<int?> GetIdByRoundAsync(int seasonId, int round);
}

public class RaceWeekendService : IRaceWeekendService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RaceWeekendService> _logger;

    public RaceWeekendService(ApplicationDbContext dbContext, ILogger<RaceWeekendService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IEnumerable<RaceWeekendResponse>> GetRaceWeekendsBySeasonAsync(int seasonId)
    {
        _logger.LogDebug("Fetching race weekends for season {SeasonId}", seasonId);

        var raceWeekends = await _dbContext
            .RaceWeekends.Where(r => r.SeasonId == seasonId)
            .Include(r => r.Circuit)
            .OrderBy(r => r.Round)
            .ToListAsync();

        _logger.LogDebug(
            "Found {Count} race weekends for season {SeasonId}",
            raceWeekends.Count,
            seasonId
        );

        var now = DateTime.UtcNow;
        var currentRaceWeekendId = raceWeekends.FirstOrDefault(r => r.RaceDate >= now)?.Id;

        return raceWeekends.ToResponseModel(currentRaceWeekendId);
    }

    public async Task<RaceWeekendResponse?> GetRaceWeekendByRoundAsync(int seasonId, int round)
    {
        _logger.LogDebug(
            "Fetching race weekend for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        var raceWeekend = await _dbContext
            .RaceWeekends.Include(r => r.Circuit)
            .FirstOrDefaultAsync(r => r.SeasonId == seasonId && r.Round == round);

        if (raceWeekend is null)
            return null;

        var now = DateTime.UtcNow;
        var currentRaceWeekendId = await _dbContext
            .RaceWeekends.Where(r => r.SeasonId == seasonId && r.RaceDate >= now)
            .OrderBy(r => r.Round)
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();

        return raceWeekend.ToResponseModel(currentRaceWeekendId);
    }

    public async Task<int?> GetIdByRoundAsync(int seasonId, int round)
    {
        _logger.LogDebug(
            "Resolving race weekend ID for season {SeasonId}, round {Round}",
            seasonId,
            round
        );

        return await _dbContext
            .RaceWeekends.Where(r => r.SeasonId == seasonId && r.Round == round)
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();
    }
}
