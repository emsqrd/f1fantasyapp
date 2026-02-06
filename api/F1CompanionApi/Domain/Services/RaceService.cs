using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;

using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IRaceService
{
    Task<IEnumerable<RaceResponse>> GetRacesAsync(int? seasonId = null);
    Task<RaceResponse?> GetRaceByIdAsync(int id);
}

public class RaceService : IRaceService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<RaceService> _logger;
    private readonly ISeasonService _seasonService;

    public RaceService(
        ApplicationDbContext dbContext,
        ILogger<RaceService> logger,
        ISeasonService seasonService)
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

        var races = await _dbContext.Races
            .Where(r => r.SeasonId == seasonId)
            .OrderBy(r => r.Round)
            .ToListAsync();

        _logger.LogDebug("Found {RaceCount} races for season {SeasonId}", races.Count, seasonId);

        var now = DateTime.UtcNow;
        var currentRaceId = races.FirstOrDefault(r => r.RaceDate >= now)?.Id;

        return races.ToResponseModel(currentRaceId);
    }

    public async Task<RaceResponse?> GetRaceByIdAsync(int id)
    {
        _logger.LogDebug("Fetching race {RaceId}", id);

        var race = await _dbContext.Races.FindAsync(id);

        if (race is null) return null;

        var now = DateTime.UtcNow;
        var currentRaceId = await _dbContext.Races
            .Where(r => r.SeasonId == race.SeasonId && r.RaceDate >= now)
            .OrderBy(r => r.Round)
            .Select(r => (int?)r.Id)
            .FirstOrDefaultAsync();

        return race.ToResponseModel(currentRaceId);
    }
}
