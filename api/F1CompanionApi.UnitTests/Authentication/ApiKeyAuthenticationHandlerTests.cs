using System.Text.Encodings.Web;
using F1CompanionApi.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace F1CompanionApi.UnitTests.Authentication;

public class ApiKeyAuthenticationHandlerTests
{
    private const string ValidApiKey = "test-api-key-12345";

    private static async Task<AuthenticateResult> AuthenticateAsync(
        string? headerValue,
        string? configuredKey
    )
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?> { ["Authentication:ApiKey"] = configuredKey }
            )
            .Build();

        var optionsMock = new Mock<IOptionsMonitor<AuthenticationSchemeOptions>>();
        optionsMock
            .Setup(o => o.Get(It.IsAny<string>()))
            .Returns(new AuthenticationSchemeOptions());

        var handler = new ApiKeyAuthenticationHandler(
            optionsMock.Object,
            new LoggerFactory(),
            UrlEncoder.Default,
            config
        );

        var scheme = new AuthenticationScheme(
            ApiKeyAuthenticationHandler.SchemeName,
            null,
            typeof(ApiKeyAuthenticationHandler)
        );

        var context = new DefaultHttpContext();
        if (headerValue != null)
            context.Request.Headers[ApiKeyAuthenticationHandler.HeaderName] = headerValue;

        await handler.InitializeAsync(scheme, context);
        return await handler.AuthenticateAsync();
    }

    [Fact]
    public async Task HandleAuthenticateAsync_NoHeader_ReturnsNoResult()
    {
        var result = await AuthenticateAsync(null, ValidApiKey);

        Assert.False(result.Succeeded);
        Assert.Null(result.Failure);
    }

    [Fact]
    public async Task HandleAuthenticateAsync_ValidKey_ReturnsSuccess()
    {
        var result = await AuthenticateAsync(ValidApiKey, ValidApiKey);

        Assert.True(result.Succeeded);
        Assert.NotNull(result.Principal);
    }

    [Fact]
    public async Task HandleAuthenticateAsync_InvalidKey_ReturnsFail()
    {
        var result = await AuthenticateAsync("wrong-key", ValidApiKey);

        Assert.False(result.Succeeded);
        Assert.NotNull(result.Failure);
    }

    [Fact]
    public async Task HandleAuthenticateAsync_UnconfiguredKey_ReturnsFail()
    {
        var result = await AuthenticateAsync(ValidApiKey, null);

        Assert.False(result.Succeeded);
        Assert.NotNull(result.Failure);
    }
}
