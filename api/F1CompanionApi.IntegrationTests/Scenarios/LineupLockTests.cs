using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class LineupLockTests : IntegrationTestBase
{
    public LineupLockTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task OwnerCanChangeLineupBeforeLock()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        Driver driver = null!;
        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                lockDeadline: DateTime.UtcNow.AddDays(1)
            );
            await db.CreateTeamAsync(profile.Id);
            driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");
        });

        var response = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driver.Id, SlotPosition = 0 }
        );

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        var only = Assert.Single(team!.Drivers);
        Assert.Equal(driver.Id, only.Id);
    }

    [Fact]
    public async Task OwnerCannotChangeLineupAfterLock()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        Driver driver = null!;
        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                lockDeadline: DateTime.UtcNow.AddHours(-1)
            );
            await db.CreateTeamAsync(profile.Id);
            driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");
        });

        var response = await client.PostAsJsonAsync(
            "/api/me/team/drivers",
            new AddDriverToTeamRequest { DriverId = driver.Id, SlotPosition = 0 }
        );

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Empty(team!.Drivers);
    }

    [Fact]
    public async Task OwnerCanRemoveDriverBeforeLock()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                lockDeadline: DateTime.UtcNow.AddDays(1)
            );
            var team = await db.CreateTeamAsync(profile.Id);
            var driver = await db.CreateDriverAsync("VER", "Max", "Verstappen");
            db.TeamDrivers.Add(
                new TeamDriver
                {
                    TeamId = team.Id,
                    DriverId = driver.Id,
                    SlotPosition = 0,
                    CreatedBy = profile.Id,
                    CreatedAt = DateTime.UtcNow,
                }
            );
            await db.SaveChangesAsync();
        });

        var response = await client.DeleteAsync("/api/me/team/drivers/0");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var team = await client.GetFromJsonAsync<TeamDetailsResponse>("/api/me/team/");
        Assert.NotNull(team);
        Assert.Empty(team!.Drivers);
    }
}
