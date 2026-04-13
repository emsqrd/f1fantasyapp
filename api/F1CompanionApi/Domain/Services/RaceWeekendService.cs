using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IRaceWeekendService
{
    Task<IEnumerable<RaceResponse>> GetRacesAsync(int? seasonId = null);
    Task<RaceResponse?> GetRaceByIdAsync(int id);
}

public class RaceWeekendService : IRaceWeekendService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RaceWeekendService> _logger;
    private readonly ISeasonService _seasonService;

    public RaceWeekendService(
        ApplicationDbContext dbContext,
        ILogger<RaceWeekendService> logger,
        ISeasonService seasonService
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);
        ArgumentNullException.ThrowIfNull(seasonService);

        _dbContext = dbContext;
        _logger = logger;
        _seasonService = seasonService;
    }

    public async Task<IEnumerable<RaceResponse>> GetRacesAsync(int? seasonId = null)
    {
        _logger.LogDebug("Fetching races for season {SeasonId}", seasonId);

        // If no seasonId provided, find the current season
        if (seasonId is null)
        {
            var currentSeason = await _seasonService.GetCurrentSeasonAsync();
            seasonId = currentSeason?.Id;

            if (seasonId is null)
            {
                _logger.LogWarning("No current season found");
                return [];
            }
        }

        var raceWeekends = await _dbContext
            .RaceWeekends.Where(r => r.SeasonId == seasonId)
            .Include(r => r.Circuit)
            .OrderBy(r => r.Round)
            .ToListAsync();

        _logger.LogDebug(
            "Found {RaceCount} races for season {SeasonId}",
            raceWeekends.Count,
            seasonId
        );

        var now = DateTime.UtcNow;
        var currentRaceWeekendId = raceWeekends.FirstOrDefault(r => r.RaceDate >= now)?.Id;

        return raceWeekends.ToResponseModel(currentRaceWeekendId);
    }

    public async Task<RaceResponse?> GetRaceByIdAsync(int id)
    {
        _logger.LogDebug("Fetching race {RaceId}", id);

        var raceWeekend = await _dbContext
            .RaceWeekends.Include(r => r.Circuit)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (raceWeekend is null)
            return null;

        var now = DateTime.UtcNow;
        var currentRaceWeekendId = await _dbContext
            .RaceWeekends.Where(r => r.SeasonId == raceWeekend.SeasonId && r.RaceDate >= now)
            .OrderBy(r => r.Round)
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();

        return raceWeekend.ToResponseModel(currentRaceWeekendId);
    }
}
