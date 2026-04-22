using System.Net;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class AuthorizationTests : IntegrationTestBase
{
    public AuthorizationTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task UnauthenticatedCallerCannotAccessProtectedEndpoints()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/me/profile");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
