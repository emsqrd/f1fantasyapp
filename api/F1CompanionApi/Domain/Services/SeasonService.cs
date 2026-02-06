using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;

using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ISeasonService
{
    Task<IEnumerable<SeasonResponse>> GetSeasonsAsync();
    Task<SeasonResponse?> GetSeasonByIdAsync(int id);
    Task<Season?> GetCurrentSeasonAsync();
}

public class SeasonService : ISeasonService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<SeasonService> _logger;

    public SeasonService(ApplicationDbContext dbContext, ILogger<SeasonService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IEnumerable<SeasonResponse>> GetSeasonsAsync()
    {
        _logger.LogDebug("Fetching all seasons");

        var seasons = await _dbContext.Seasons
            .OrderBy(s => s.Year)
            .ToListAsync();

        _logger.LogDebug("Found {SeasonsCount} seasons", seasons.Count);

        var currentSeason = await GetCurrentSeasonAsync();
        var currentSeasonId = currentSeason?.Id;

        return seasons.ToResponseModel(currentSeasonId);
    }

    public async Task<SeasonResponse?> GetSeasonByIdAsync(int id)
    {
        _logger.LogDebug("Fetching season {SeasonId}", id);

        var season = await _dbContext.Seasons.FindAsync(id);

        if (season is null) return null;

        var currentSeason = await GetCurrentSeasonAsync();
        var currentSeasonId = currentSeason?.Id;

        return season.ToResponseModel(currentSeasonId);
    }

    public async Task<Season?> GetCurrentSeasonAsync()
    {
        _logger.LogDebug("Fetching current season");

        var now = DateTime.UtcNow;
        var currentSeason = await _dbContext.Seasons
            .FirstOrDefaultAsync(s => now >= s.StartDate && now <= s.EndDate);

        if (currentSeason is not null)
        {
            _logger.LogDebug("Current season is {Year}", currentSeason.Year);
        }
        else
        {
            _logger.LogDebug("No current season found");
        }

        return currentSeason;
    }
}
