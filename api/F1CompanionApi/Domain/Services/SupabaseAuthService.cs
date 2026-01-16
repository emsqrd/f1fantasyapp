using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace F1CompanionApi.Domain.Services;

public interface ISupabaseAuthService
{
    ClaimsPrincipal? ValidateToken(string token);
    string? GetUserId();
    string GetRequiredUserId();
    string? GetUserEmail();
}

public class SupabaseAuthService : ISupabaseAuthService
{
    private readonly string _jwtSecret;
    private readonly JwtSecurityTokenHandler _tokenHandler;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SupabaseAuthService(
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor
    )
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(httpContextAccessor);

        _jwtSecret = configuration["Supabase:JwtSecret"] ?? throw new InvalidOperationException("Supabase JWT secret not configured");
        _tokenHandler = new JwtSecurityTokenHandler();
        _httpContextAccessor = httpContextAccessor;
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        try
        {
            var key = Encoding.UTF8.GetBytes(_jwtSecret);
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = false,
                ValidateAudience = true,
                ValidAudience = "authenticated",
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero,
            };

            var principal = _tokenHandler.ValidateToken(token, validationParameters, out _);
            return principal;
        }
        catch
        {
            return null;
        }
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
        return user?.FindFirst(ClaimTypes.Email)?.Value
            ?? user?.FindFirst("email")?.Value;
    }
}
