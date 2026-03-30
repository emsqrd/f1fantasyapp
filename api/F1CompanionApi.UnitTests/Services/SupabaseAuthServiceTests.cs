using System.Security.Claims;
using F1CompanionApi.Domain.Services;
using Microsoft.AspNetCore.Http;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class SupabaseAuthServiceTests
{
    private const string TestUserId = "test-user-id-123";
    private const string TestUserEmail = "test@example.com";

    [Fact]
    public void Constructor_NullHttpContextAccessor_ThrowsArgumentNullException()
    {
        Assert.Throws<ArgumentNullException>(() => new SupabaseAuthService(null!));
    }

    [Fact]
    public void GetUserId_UserIdClaimExists_ReturnsUserId()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Equal(TestUserId, result);
    }

    [Fact]
    public void GetUserId_NoUserIdClaim_ReturnsNull()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var identity = new ClaimsIdentity(Array.Empty<Claim>(), "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetUserId_NoHttpContext_ReturnsNull()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserId();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetRequiredUserId_UserIdExists_ReturnsUserId()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, TestUserId) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetRequiredUserId();

        // Assert
        Assert.Equal(TestUserId, result);
    }

    [Fact]
    public void GetRequiredUserId_UserIdDoesNotExist_ThrowsInvalidOperationException()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var identity = new ClaimsIdentity(Array.Empty<Claim>(), "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act & Assert
        var exception = Assert.Throws<InvalidOperationException>(() => service.GetRequiredUserId());
        Assert.Contains("User ID not found", exception.Message);
    }

    [Fact]
    public void GetUserEmail_EmailClaimExists_ReturnsEmail()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[] { new Claim(ClaimTypes.Email, TestUserEmail) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Equal(TestUserEmail, result);
    }

    [Fact]
    public void GetUserEmail_FallsBackToLowercaseEmailClaim_ReturnsEmail()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var claims = new[] { new Claim("email", TestUserEmail) };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Equal(TestUserEmail, result);
    }

    [Fact]
    public void GetUserEmail_NoEmailClaim_ReturnsNull()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        var httpContext = new DefaultHttpContext();

        var identity = new ClaimsIdentity(Array.Empty<Claim>(), "TestAuth");
        httpContext.User = new ClaimsPrincipal(identity);

        httpContextAccessor.Setup(x => x.HttpContext).Returns(httpContext);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Null(result);
    }

    [Fact]
    public void GetUserEmail_NoHttpContext_ReturnsNull()
    {
        // Arrange
        var httpContextAccessor = new Mock<IHttpContextAccessor>();
        httpContextAccessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);

        var service = new SupabaseAuthService(httpContextAccessor.Object);

        // Act
        var result = service.GetUserEmail();

        // Assert
        Assert.Null(result);
    }
}
