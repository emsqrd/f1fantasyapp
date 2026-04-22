using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class BudgetCapTests : IntegrationTestBase
{
    public BudgetCapTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task OwnerCanBuildTeamWithinCap()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        var driverIds = new int[5];
        var constructorIds = new int[2];
        await WithDbAsync(async db =>
        {
            await db.CreateCurrentSeasonAsync();
            await db.CreateTeamAsync(profile.Id);

            for (var i = 0; i < 5; i++)
            {
                var driver = await db.CreateDriverAsync(
                    abbreviation: $"D{i:D2}",
                    firstName: $"First{i}",
                    lastName: $"Last{i}",
                    price: 10_000_000m
                );
                driverIds[i] = driver.Id;
            }

            for (var i = 0; i < 2; i++)
            {
                var constructor = await db.CreateConstructorAsync(
                    name: $"Con{i}",
                    price: 10_000_000m
                );
                constructorIds[i] = constructor.Id;
            }
        });

        for (var slot = 0; slot < 5; slot++)
        {
            var response = await client.PostAsJsonAsync(
                "/api/me/team/drivers",
                new AddDriverToTeamRequest { DriverId = driverIds[slot], SlotPosition = slot }
            );
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        for (var slot = 0; slot < 2; slot++)
        {
            var response = await client.PostAsJsonAsync(
                "/api/me/team/constructors",
                new AddConstructorToTeamRequest
                {
                    ConstructorId = constructorIds[slot],
                    SlotPosition = slot,
                }
            );
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        }

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Equal(5, team!.Drivers.Count);
        Assert.Equal(2, team.Constructors.Count);
    }

    [Fact]
    public async Task OwnerCannotAddPickThatExceedsCap()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        var cheapDriverIds = new int[2];
        var expensiveDriverId = 0;
        await WithDbAsync(async db =>
        {
            await db.CreateCurrentSeasonAsync();
            await db.CreateTeamAsync(profile.Id);

            var d1 = await db.CreateDriverAsync("VER", "Max", "Verstappen", price: 30_000_000m);
            var d2 = await db.CreateDriverAsync("NOR", "Lando", "Norris", price: 30_000_000m);
            cheapDriverIds[0] = d1.Id;
            cheapDriverIds[1] = d2.Id;

            var d3 = await db.CreateDriverAsync("HAM", "Lewis", "Hamilton", price: 50_000_000m);
            expensiveDriverId = d3.Id;
        });

        for (var slot = 0; slot < 2; slot++)
        {
            var add = await client.PostAsJsonAsync(
                "/api/me/team/drivers",
                new AddDriverToTeamRequest { DriverId = cheapDriverIds[slot], SlotPosition = slot }
            );
            Assert.Equal(HttpStatusCode.NoContent, add.StatusCode);
        }

        var overflow = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = expensiveDriverId, SlotPosition = 2 }
        );
        Assert.Equal(HttpStatusCode.BadRequest, overflow.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Equal(2, team!.Drivers.Count);
        Assert.DoesNotContain(expensiveDriverId, team.Drivers.Select(d => d.Id));
    }
}
