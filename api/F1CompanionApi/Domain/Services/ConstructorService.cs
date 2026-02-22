using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IConstructorService
{
    Task<IEnumerable<ConstructorResponse>> GetConstructorsAsync(int? seasonYear);
    Task<ConstructorResponse?> GetConstructorByIdAsync(int id);
}

public class ConstructorService : IConstructorService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ISeasonService _seasonService;
    private readonly ILogger<ConstructorService> _logger;

    public ConstructorService(
        ApplicationDbContext dbContext,
        ISeasonService seasonService,
        ILogger<ConstructorService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(seasonService);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _seasonService = seasonService;
        _logger = logger;
    }

    public async Task<IEnumerable<ConstructorResponse>> GetConstructorsAsync(int? seasonYear)
    {
        _logger.LogDebug("Fetching constructors for season year {SeasonYear}", seasonYear);

        var season = await _seasonService.GetSeasonAsync(seasonYear);

        if (season is null)
        {
            _logger.LogDebug("No season found, returning empty list");
            return [];
        }

        var constructors = await _dbContext
            .SeasonConstructors.Where(sc => sc.SeasonId == season.Id && sc.IsActive)
            .Include(sc => sc.Constructor)
            .OrderBy(sc => sc.Constructor.Name)
            .Select(sc => sc.Constructor)
            .ToListAsync();

        _logger.LogDebug(
            "Retrieved {ConstructorCount} constructors for season {SeasonYear}",
            constructors.Count,
            season.Year
        );

        return constructors.ToResponseModel();
    }

    public async Task<ConstructorResponse?> GetConstructorByIdAsync(int id)
    {
        var constructor = await _dbContext.Constructors.FirstOrDefaultAsync(x => x.Id == id);

        if (constructor is null)
        {
            _logger.LogWarning("Constructor {ConstructorId} not found", id);
        }

        return constructor?.ToResponseModel();
    }
}
