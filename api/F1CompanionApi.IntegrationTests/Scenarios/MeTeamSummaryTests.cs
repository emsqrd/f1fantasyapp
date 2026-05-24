using System.Net;
using System.Net.Http.Json;
using F1CompanionApi.Api.Models;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.IntegrationTests.Support;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class MeTeamSummaryTests : IntegrationTestBase
{
    public MeTeamSummaryTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task GetMyTeamSummary_Unauthenticated_Returns401()
    {
        var anonClient = Factory.CreateClient();

        var response = await anonClient.GetAsync("/api/me/team/summary");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetMyTeamSummary_NoTeam_Returns404()
    {
        var (client, _) = await Factory.CreateAuthenticatedAsync();

        var response = await client.GetAsync("/api/me/team/summary");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetMyTeamSummary_HappyPath_SumsCurrentSeasonAndPicksLatestRace()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        await WithDbAsync(async db =>
        {
            var currentSeason = await db.CreateCurrentSeasonAsync();
            var priorSeason = new Season
            {
                Year = currentSeason.Year - 1,
                StartDate = DateTime.UtcNow.AddDays(-400),
                EndDate = DateTime.UtcNow.AddDays(-100),
            };
            db.Seasons.Add(priorSeason);
            await db.SaveChangesAsync();

            var team = await db.CreateTeamAsync(profile.Id);

            // Three current-season scored rounds, out of insertion order, so the test
            // verifies "latest by Round" rather than insertion or RaceDate order.
            var w2 = await db.CreateRaceWeekendAsync(
                currentSeason.Id,
                raceDate: DateTime.UtcNow.AddDays(-14),
                round: 2,
                name: "Round Two GP"
            );
            var w1 = await db.CreateRaceWeekendAsync(
                currentSeason.Id,
                raceDate: DateTime.UtcNow.AddDays(-21),
                round: 1,
                name: "Round One GP"
            );
            var w3 = await db.CreateRaceWeekendAsync(
                currentSeason.Id,
                raceDate: DateTime.UtcNow.AddDays(-7),
                round: 3,
                name: "Round Three GP"
            );
            var priorSeasonRace = await db.CreateRaceWeekendAsync(
                priorSeason.Id,
                raceDate: DateTime.UtcNow.AddDays(-200),
                round: 1,
                name: "Prior Season Finale"
            );

            db.TeamRaceWeekendScores.AddRange(
                Score(team.Id, w1.Id, 25),
                Score(team.Id, w2.Id, 40),
                Score(team.Id, w3.Id, 18),
                // Prior-season score must NOT contribute to sum or latest-race pick.
                Score(team.Id, priorSeasonRace.Id, 999)
            );
            await db.SaveChangesAsync();
        });

        var summary = await client.GetFromJsonAsync<TeamSummaryResponse>("/api/me/team/summary");

        Assert.NotNull(summary);
        Assert.Equal(25 + 40 + 18, summary!.SeasonTotalPoints);
        Assert.NotNull(summary.LastRace);
        Assert.Equal(3, summary.LastRace!.Round);
        Assert.Equal("Round Three GP", summary.LastRace.Name);
        Assert.Equal(18, summary.LastRace.TotalScore);
    }

    private static TeamRaceWeekendScore Score(int teamId, int raceWeekendId, int total) =>
        new()
        {
            TeamId = teamId,
            RaceWeekendId = raceWeekendId,
            TotalPoints = total,
            CalculatedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };
}
