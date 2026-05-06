using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Services;
using F1CompanionApi.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace F1CompanionApi.IntegrationTests.Scenarios;

/// <summary>
/// Exercises <see cref="ILeagueStandingsService.UpdateLeagueStandingsForRaceWeekendAsync"/> against
/// real Postgres for behaviors that depend on EF query semantics, transaction wrapping,
/// and the delete + insert idempotency path. Pure ranking logic is covered by
/// <c>StandingsRankerTests</c> in the unit-test project.
/// </summary>
public class StandingsCalculationTests : IntegrationTestBase
{
    public StandingsCalculationTests(PostgresFixture postgres)
        : base(postgres) { }

    [Fact]
    public async Task UpdateStandingsForRaceWeekend_TwoLeaguesWithOverlappingTeams_RanksIndependently()
    {
        var fixture = await SeedAsync(teamCount: 3, leagueCount: 2);

        await WithDbAsync(async db =>
        {
            // Remove team 3 from league 2 so the leagues differ.
            var team3InL2 = await db.LeagueTeams.SingleAsync(lt =>
                lt.LeagueId == fixture.LeagueIds[1] && lt.TeamId == fixture.TeamIds[2]
            );
            db.LeagueTeams.Remove(team3InL2);

            db.TeamRaceWeekendScores.AddRange(
                Score(fixture.TeamIds[0], fixture.WeekendIds[0], 10),
                Score(fixture.TeamIds[1], fixture.WeekendIds[0], 20),
                Score(fixture.TeamIds[2], fixture.WeekendIds[0], 30)
            );
            await db.SaveChangesAsync();
        });

        await RunStandingsAsync(fixture.WeekendIds[0]);

        await WithDbAsync(async db =>
        {
            var league1 = await db
                .TeamLeagueStandings.Where(ls => ls.LeagueId == fixture.LeagueIds[0])
                .OrderBy(ls => ls.Position)
                .ToListAsync();
            var league2 = await db
                .TeamLeagueStandings.Where(ls => ls.LeagueId == fixture.LeagueIds[1])
                .OrderBy(ls => ls.Position)
                .ToListAsync();

            Assert.Equal(3, league1.Count);
            Assert.Equal(fixture.TeamIds[2], league1[0].TeamId);
            Assert.Equal(fixture.TeamIds[1], league1[1].TeamId);
            Assert.Equal(fixture.TeamIds[0], league1[2].TeamId);

            Assert.Equal(2, league2.Count);
            Assert.Equal(fixture.TeamIds[1], league2[0].TeamId);
            Assert.Equal(fixture.TeamIds[0], league2[1].TeamId);
        });
    }

    [Fact]
    public async Task UpdateStandingsForRaceWeekend_RunTwiceForSameRound_ReplacesRowsWithoutDuplicates()
    {
        var fixture = await SeedAsync(teamCount: 2, leagueCount: 1);

        await WithDbAsync(async db =>
        {
            db.TeamRaceWeekendScores.AddRange(
                Score(fixture.TeamIds[0], fixture.WeekendIds[0], 30),
                Score(fixture.TeamIds[1], fixture.WeekendIds[0], 50)
            );
            await db.SaveChangesAsync();
        });

        await RunStandingsAsync(fixture.WeekendIds[0]);
        await RunStandingsAsync(fixture.WeekendIds[0]);

        await WithDbAsync(async db =>
        {
            var rows = await db
                .TeamLeagueStandings.Where(ls => ls.LeagueId == fixture.LeagueIds[0])
                .ToListAsync();
            Assert.Equal(2, rows.Count);
            Assert.Single(rows, r => r.TeamId == fixture.TeamIds[0]);
            Assert.Single(rows, r => r.TeamId == fixture.TeamIds[1]);
        });
    }

    [Fact]
    public async Task UpdateStandingsForRaceWeekend_NoScoresForRound_WritesNoRows()
    {
        var fixture = await SeedAsync(teamCount: 2, leagueCount: 1);

        await RunStandingsAsync(fixture.WeekendIds[0]);

        await WithDbAsync(async db =>
        {
            Assert.Empty(await db.TeamLeagueStandings.ToListAsync());
        });
    }

    private async Task<SeededFixture> SeedAsync(int teamCount, int leagueCount)
    {
        var teamIds = new int[teamCount];
        var leagueIds = new int[leagueCount];
        var weekendIds = new int[1];

        await WithDbAsync(async db =>
        {
            var season = await db.CreateCurrentSeasonAsync();
            var weekend = await db.CreateRaceWeekendAsync(
                season.Id,
                raceDate: DateTime.UtcNow.AddDays(2),
                round: 1
            );
            weekendIds[0] = weekend.Id;

            var ownerProfile = await CreateProfileAsync(db, "owner@test.local");

            for (var i = 0; i < teamCount; i++)
            {
                var profile = await CreateProfileAsync(db, $"player{i}@test.local");
                var team = await db.CreateTeamAsync(profile.Id, $"Team {i + 1}");
                teamIds[i] = team.Id;
            }

            for (var i = 0; i < leagueCount; i++)
            {
                var league = new League
                {
                    Name = $"League {i + 1}",
                    OwnerId = ownerProfile.Id,
                    CreatedBy = ownerProfile.Id,
                    CreatedAt = DateTime.UtcNow,
                };
                db.Leagues.Add(league);
                await db.SaveChangesAsync();
                leagueIds[i] = league.Id;

                foreach (var teamId in teamIds)
                {
                    db.LeagueTeams.Add(
                        new LeagueTeam
                        {
                            LeagueId = league.Id,
                            TeamId = teamId,
                            CreatedBy = ownerProfile.Id,
                            CreatedAt = DateTime.UtcNow,
                        }
                    );
                }
                await db.SaveChangesAsync();
            }
        });

        return new SeededFixture(teamIds, leagueIds, weekendIds);
    }

    private static async Task<UserProfile> CreateProfileAsync(ApplicationDbContext db, string email)
    {
        var account = new Account
        {
            Id = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            IsActive = true,
        };
        db.Accounts.Add(account);
        var profile = new UserProfile
        {
            AccountId = account.Id,
            Email = $"{Guid.NewGuid():N}-{email}",
            CreatedAt = DateTime.UtcNow,
        };
        db.UserProfiles.Add(profile);
        await db.SaveChangesAsync();
        return profile;
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

    private async Task RunStandingsAsync(int raceWeekendId)
    {
        await using var scope = Factory.Services.CreateAsyncScope();
        var svc = scope.ServiceProvider.GetRequiredService<ILeagueStandingsService>();
        await svc.UpdateLeagueStandingsForRaceWeekendAsync(raceWeekendId);
    }

    private record SeededFixture(int[] TeamIds, int[] LeagueIds, int[] WeekendIds);
}
