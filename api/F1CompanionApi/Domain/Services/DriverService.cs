using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IDriverService
{
    Task<IEnumerable<DriverResponse>> GetDriversAsync(bool? activeOnly);
    Task<DriverResponse?> GetDriverByIdAsync(int id);
}

public class DriverService : IDriverService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<DriverService> _logger;

    public DriverService(ApplicationDbContext dbContext, ILogger<DriverService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IEnumerable<DriverResponse>> GetDriversAsync(bool? activeOnly = null)
    {
        _logger.LogDebug("Fetching all drivers");

        var query = _dbContext.Drivers.AsQueryable();

        if (activeOnly is not null)
        {
            query = query.Where(driver => driver.IsActive == activeOnly);
        }

        var drivers = await query
            .OrderBy(o => o.LastName)
            .ToListAsync();

        _logger.LogDebug("Retrieved {DriverCount} drivers", drivers.Count);

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
