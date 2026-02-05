using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;

using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface ISeasonService
{
    Task<IEnumerable<SeasonResponse>> GetSeasonsAsync();
    Task<SeasonResponse?> GetSeasonByIdAsync(int id);
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

        var now = DateTime.UtcNow;
        var currentSeasonId = seasons.FirstOrDefault(s => now >= s.StartDate && now <= s.EndDate)?.Id;

        return seasons.ToResponseModel(currentSeasonId);
    }

    public async Task<SeasonResponse?> GetSeasonByIdAsync(int id)
    {
        var season = await _dbContext.Seasons.FindAsync(id);

        if (season is null) return null;

        var now = DateTime.UtcNow;
        var isCurrent = now >= season.StartDate && now <= season.EndDate;
        int? currentSeasonId = isCurrent ? season.Id : null;

        return season.ToResponseModel(currentSeasonId);
    }
}
