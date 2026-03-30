using System.Security.Claims;

namespace F1CompanionApi.Domain.Services;

public interface ISupabaseAuthService
{
    string? GetUserId();
    string GetRequiredUserId();
    string? GetUserEmail();
}

public class SupabaseAuthService : ISupabaseAuthService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SupabaseAuthService(IHttpContextAccessor httpContextAccessor)
    {
        ArgumentNullException.ThrowIfNull(httpContextAccessor);
        _httpContextAccessor = httpContextAccessor;
    }

    public string? GetUserId()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    public string GetRequiredUserId()
    {
        return GetUserId() ?? throw new InvalidOperationException("User ID not found");
    }

    public string? GetUserEmail()
    {
        var user = _httpContextAccessor.HttpContext?.User;
        return user?.FindFirst(ClaimTypes.Email)?.Value ?? user?.FindFirst("email")?.Value;
    }
}
