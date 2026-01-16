using F1CompanionApi.Api.Mappers;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IConstructorService
{
    Task<IEnumerable<ConstructorResponse>> GetConstructorsAsync(bool? activeOnly);
    Task<ConstructorResponse?> GetConstructorByIdAsync(int id);
}

public class ConstructorService : IConstructorService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<ConstructorService> _logger;

    public ConstructorService(ApplicationDbContext dbContext, ILogger<ConstructorService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IEnumerable<ConstructorResponse>> GetConstructorsAsync(bool? activeOnly)
    {
        var query = _dbContext.Constructors.AsQueryable();

        if (activeOnly is not null)
        {
            query = query.Where(constructor => constructor.IsActive == activeOnly);
        }

        var constructors = await query
            .OrderBy(x => x.Name)
            .ToListAsync();

        _logger.LogDebug("Retrieved {ConstructorCount} constructors", constructors.Count);

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
