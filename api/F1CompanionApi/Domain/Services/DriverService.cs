using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IDriverService
{
    Task<IEnumerable<DriverResponse>> GetDriversAsync(int? seasonYear);
    Task<DriverResponse?> GetDriverByIdAsync(int id);
}

public class DriverService : IDriverService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ISeasonService _seasonService;
    private readonly ILogger<DriverService> _logger;

    public DriverService(
        ApplicationDbContext dbContext,
        ISeasonService seasonService,
        ILogger<DriverService> logger
    )
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(seasonService);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _seasonService = seasonService;
        _logger = logger;
    }

    public async Task<IEnumerable<DriverResponse>> GetDriversAsync(int? seasonYear = null)
    {
        _logger.LogDebug("Fetching drivers for season year {SeasonYear}", seasonYear);

        var season = await _seasonService.GetSeasonAsync(seasonYear);

        if (season is null)
        {
            _logger.LogDebug("No season found, returning empty list");
            return [];
        }

        var drivers = await _dbContext
            .SeasonDrivers.Where(sd => sd.SeasonId == season.Id && sd.IsActive)
            .Include(sd => sd.Driver)
            .OrderBy(sd => sd.Driver.LastName)
            .Select(sd => sd.Driver)
            .ToListAsync();

        _logger.LogDebug(
            "Retrieved {DriverCount} drivers for season {SeasonYear}",
            drivers.Count,
            season.Year
        );

        return drivers.ToResponseModel();
    }

    public async Task<DriverResponse?> GetDriverByIdAsync(int id)
    {
        _logger.LogDebug("Fetching driver with id {id}", id);

        var driver = await _dbContext.Drivers.FirstOrDefaultAsync(x => x.Id == id);

        if (driver is null)
        {
            _logger.LogWarning("Driver {DriverId} not found", id);
        }

        return driver?.ToResponseModel();
    }
}
