using F1CompanionApi.IntegrationTests.Support;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.IntegrationTests.Scenarios;

public class ScoringRollupTests : IntegrationTestBase
{
    public ScoringRollupTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task ScoringTriggerIsNotExposedToPlayers()
    {
        var (client, profile) = await Factory.CreateAuthenticatedAsync();

        int seasonId = 0;
        int round = 0;
        int teamId = 0;
        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var race = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(1),
                round: 1
            );
            var team = await db.CreateTeamAsync(profile.Id);
            seasonId = season.Id;
            round = race.Round;
            teamId = team.Id;
        });

        var response = await client.PostAsync(
            $"/api/seasons/{seasonId}/race-weekends/{round}/score",
            content: null
        );
        response.IsSuccessStatusCode.Should().BeFalse();

        var scoreCount = await WithDbAsync(async db =>
            await db.TeamRaceWeekendScores.CountAsync(s => s.TeamId == teamId)
        );
        scoreCount.Should().Be(0);
    }
}
