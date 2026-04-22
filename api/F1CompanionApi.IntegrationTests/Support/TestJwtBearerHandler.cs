using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Test stand-in for <see cref="JwtBearerHandler"/>. Registered in DI by replacing the
/// concrete <c>JwtBearerHandler</c> service so the existing <c>Bearer</c> scheme stays
/// intact (policies, defaults, options) while the actual token validation is bypassed.
/// Reads the <c>X-Test-User-Id</c> header and builds a ClaimsPrincipal whose
/// <see cref="ClaimTypes.NameIdentifier"/> claim mirrors what SupabaseAuthService reads
/// from a real Supabase JWT. Requests without the header remain unauthenticated.
/// </summary>
public class TestJwtBearerHandler(
    IOptionsMonitor<JwtBearerOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder
) : JwtBearerHandler(options, logger, encoder)
{
    public const string UserIdHeader = "X-Test-User-Id";
    public const string UserEmailHeader = "X-Test-User-Email";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UserIdHeader, out var userIdValues))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var userId = userIdValues.ToString();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };

        if (
            Request.Headers.TryGetValue(UserEmailHeader, out var emailValues)
            && !string.IsNullOrWhiteSpace(emailValues.ToString())
        )
        {
            claims.Add(new Claim(ClaimTypes.Email, emailValues.ToString()));
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
