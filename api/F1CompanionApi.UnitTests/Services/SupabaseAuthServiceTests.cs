using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class SupabaseAuthServiceTests
{
    private const string TestJwtSecret = "test-secret-key-that-is-long-enough-for-hmac-sha256";
    private const string TestUserId = "test-user-id-123";
    private const string TestUserEmail = "test@example.com";

    private static IConfiguration CreateConfiguration()
    {
        var configData = new Dictionary<string, string?>
        {
            { "Supabase:JwtSecret", TestJwtSecret }
        };

        return new ConfigurationBuilder()
            .AddInMemoryCollection(configData)
            .Build();
    }

    private static string GenerateValidToken(string userId, string email)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(TestJwtSecret);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Email, email),
                new Claim("email", email)
            ]),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            ),
            Audience = "authenticated"
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    private static string GenerateExpiredToken(string userId, string email)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(TestJwtSecret);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Email, email)
            ]),
            NotBefore = DateTime.UtcNow.AddHours(-2),
            Expires = DateTime.UtcNow.AddHours(-1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            ),
            Audience = "authenticated"
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    [Fact]
    public void Constructor_MissingJwtSecret_ThrowsInvalidOperationException()
    {
        // Arrange
        var configData = new Dictionary<string, string?>();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(configData)
            .Build();

        var httpContextAccessor = new Mock<IHttpContextAccessor>();

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => new SupabaseAuthService(config, httpContextAccessor.Object)
        );
        Assert.Contains("Supabase JWT secret not configured", exception.Message);
    }

    [Fact]
    public void Constructor_NullHttpContextAccessor_ThrowsArgumentNullException()
    {
        // Arrange
        var config = CreateConfiguration();

        // Act & Assert
        Assert.Throws<ArgumentNullException>(
            () => new SupabaseAuthService(config, null!)
        );
    }

    [Fact]
    public void ValidateToken_ValidToken_ReturnsClaimsPrincipalWithCorrectClaims()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        var token = GenerateValidToken(TestUserId, TestUserEmail);

        // Act
        var result = service.ValidateToken(token);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(TestUserId, result.FindFirst(ClaimTypes.NameIdentifier)?.Value);
        Assert.Equal(TestUserEmail, result.FindFirst(ClaimTypes.Email)?.Value);
    }

    [Fact]
    public void ValidateToken_ExpiredToken_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        var token = GenerateExpiredToken(TestUserId, TestUserEmail);

        // Act
        var result = service.ValidateToken(token);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void ValidateToken_InvalidSignature_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        var tokenHandler = new JwtSecurityTokenHandler();
        var wrongKey = Encoding.UTF8.GetBytes("wrong-secret-key-that-is-long-enough-for-hmac");

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, TestUserId)
            ]),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(wrongKey),
                SecurityAlgorithms.HmacSha256Signature
            ),
            Audience = "authenticated"
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        // Act
        var result = service.ValidateToken(tokenString);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void ValidateToken_MalformedToken_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.ValidateToken("not-a-valid-jwt-token");

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void ValidateToken_WrongAudience_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(TestJwtSecret);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, TestUserId)
            ]),
            Expires = DateTime.UtcNow.AddHours(1),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            ),
            Audience = "wrong-audience"
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(token);

        // Act
        var result = service.ValidateToken(tokenString);

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetUserId_UserIdClaimExists_ReturnsUserId()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, TestUserId)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Equal(TestUserId, result);
    }

    [Fact]
    public void GetUserId_NoUserIdClaim_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = Array.Empty<Claim>();
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetUserId_NoHttpContext_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetRequiredUserId_UserIdExists_ReturnsUserId()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, TestUserId)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetRequiredUserId();

        // Assert
        Assert.Equal(TestUserId, result);
    }

    [Fact]
    public void GetRequiredUserId_UserIdDoesNotExist_ThrowsInvalidOperationException()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = Array.Empty<Claim>();
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(
            () => service.GetRequiredUserId()
        );
        Assert.Contains("User ID not found", exception.Message);
    }

    [Fact]
    public void GetUserEmail_EmailClaimExists_ReturnsEmail()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[]
        {
            new Claim(ClaimTypes.Email, TestUserEmail)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Equal(TestUserEmail, result);
    }

    [Fact]
    public void GetUserEmail_FallsBackToLowercaseEmailClaim_ReturnsEmail()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[]
        {
            new Claim("email", TestUserEmail)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Equal(TestUserEmail, result);
    }

    [Fact]
    public void GetUserEmail_NoEmailClaim_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = Array.Empty<Claim>();
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetUserEmail_NoHttpContext_ReturnsNull()
    {
        // Arrange
        var config = CreateConfiguration();
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);

        var service = new SupabaseAuthService(config, httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Null(result);
    }
}
