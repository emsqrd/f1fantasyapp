using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Exceptions;
using F1CompanionApi.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;

namespace F1CompanionApi.UnitTests.Services;

public class LineupServiceTests
{
    private readonly Mock<ILogger<LineupService>> _mockLogger;

    public LineupServiceTests()
    {
        _mockLogger = new Mock<ILogger<LineupService>>();
    }

    private ApplicationDbContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private LineupService CreateServiceWithContext(ApplicationDbContext context) =>
        new(context, _mockLogger.Object);

    private static Circuit SeedCircuit(int id) =>
        new()
        {
            Id = id,
            Name = "Test Circuit",
            Location = "Test",
            Country = "Test Country",
        };

    private static RaceWeekend SeedRace(
        int id,
        int round,
        int seasonId = 1,
        DateTime? lockDeadline = null
    ) =>
        new()
        {
            Id = id,
            SeasonId = seasonId,
            Round = round,
            Name = $"Round {round} GP",
            CircuitId = id,
            RaceDate = new DateTime(2026, 3, 1).AddDays(round * 7),
            LockDeadline = lockDeadline,
        };

    private static LineupEntry SeedLineupEntry(
        int teamId,
        int raceWeekendId,
        int entityId,
        LineupEntityType type,
        int slotPosition,
        bool isCaptain = false
    ) =>
        new()
        {
            TeamId = teamId,
            RaceWeekendId = raceWeekendId,
            EntityId = entityId,
            EntityType = type,
            SlotPosition = slotPosition,
            IsCaptain = isCaptain,
            CreatedAt = DateTime.UtcNow,
        };

    private static async Task SeedTwoRoundsAsync(
        ApplicationDbContext ctx,
        DateTime? nextLockDeadline = null
    )
    {
        ctx.Circuits.Add(SeedCircuit(1));
        ctx.RaceWeekends.Add(SeedRace(id: 1, round: 1));
        ctx.RaceWeekends.Add(SeedRace(id: 2, round: 2, lockDeadline: nextLockDeadline));
        await ctx.SaveChangesAsync();
    }

    [Fact]
    public async Task AdvanceLineupAsync_HappyPath_CopiesDriversConstructorsAndCaptain()
    {
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        ctx.LineupEntries.AddRange(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1, isCaptain: true),
            SeedLineupEntry(100, 1, 11, LineupEntityType.Driver, slotPosition: 2),
            SeedLineupEntry(100, 1, 20, LineupEntityType.Constructor, slotPosition: 1)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        var nextEntries = await ctx
            .LineupEntries.Where(le => le.RaceWeekendId == 2 && le.TeamId == 100)
            .OrderBy(le => le.EntityType)
            .ThenBy(le => le.SlotPosition)
            .ToListAsync();

        Assert.Equal(3, nextEntries.Count);
        Assert.Contains(
            nextEntries,
            e => e.EntityId == 10 && e.EntityType == LineupEntityType.Driver && e.IsCaptain
        );
        Assert.Contains(
            nextEntries,
            e => e.EntityId == 11 && e.EntityType == LineupEntityType.Driver && !e.IsCaptain
        );
        Assert.Contains(
            nextEntries,
            e => e.EntityId == 20 && e.EntityType == LineupEntityType.Constructor
        );
    }

    [Fact]
    public async Task AdvanceLineupAsync_SkipsTeamsThatAlreadyHaveNextRoundEntries()
    {
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        // Team 100: has round 1 lineup, already has one round 2 entry → skip
        ctx.LineupEntries.Add(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1)
        );
        ctx.LineupEntries.Add(
            SeedLineupEntry(100, 2, 99, LineupEntityType.Driver, slotPosition: 1)
        );
        // Team 200: has round 1 lineup, no round 2 entries → copy
        ctx.LineupEntries.Add(
            SeedLineupEntry(200, 1, 30, LineupEntityType.Driver, slotPosition: 1)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        var team100Round2 = await ctx
            .LineupEntries.Where(le => le.RaceWeekendId == 2 && le.TeamId == 100)
            .ToListAsync();
        Assert.Single(team100Round2);
        Assert.Equal(99, team100Round2[0].EntityId);

        var team200Round2 = await ctx
            .LineupEntries.Where(le => le.RaceWeekendId == 2 && le.TeamId == 200)
            .ToListAsync();
        Assert.Single(team200Round2);
        Assert.Equal(30, team200Round2[0].EntityId);
    }

    [Fact]
    public async Task AdvanceLineupAsync_ThrowsNextRoundLockedException_WhenNextDeadlinePassed()
    {
        using var ctx = CreateInMemoryContext();
        var lockedAt = DateTime.UtcNow.AddHours(-1);
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: lockedAt);

        ctx.LineupEntries.Add(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);

        var ex = await Assert.ThrowsAsync<NextRoundLockedException>(() =>
            service.AdvanceLineupAsync(1)
        );
        Assert.Equal(2, ex.NextRound);
        Assert.Equal(lockedAt, ex.LockedAt);

        var round2 = await ctx.LineupEntries.Where(le => le.RaceWeekendId == 2).ToListAsync();
        Assert.Empty(round2);
    }

    [Fact]
    public async Task AdvanceLineupAsync_NoOpsWhenNoNextRoundExists()
    {
        using var ctx = CreateInMemoryContext();
        ctx.Circuits.Add(SeedCircuit(1));
        ctx.RaceWeekends.Add(SeedRace(id: 1, round: 1));
        await ctx.SaveChangesAsync();

        ctx.LineupEntries.Add(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);

        await service.AdvanceLineupAsync(1);

        var all = await ctx.LineupEntries.ToListAsync();
        Assert.Single(all);
    }

    [Fact]
    public async Task AdvanceLineupAsync_TeamWithZeroRoundNEntries_ProducesZeroRoundNPlusOneEntries()
    {
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        var round2 = await ctx.LineupEntries.Where(le => le.RaceWeekendId == 2).ToListAsync();
        Assert.Empty(round2);
    }

    [Fact]
    public async Task AdvanceLineupAsync_OverCapLineup_CarriesForward()
    {
        // Documents the policy: carried lineups may exceed budget cap after price drift.
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        ctx.LineupEntries.AddRange(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1),
            SeedLineupEntry(100, 1, 11, LineupEntityType.Driver, slotPosition: 2),
            SeedLineupEntry(100, 1, 12, LineupEntityType.Driver, slotPosition: 3),
            SeedLineupEntry(100, 1, 20, LineupEntityType.Constructor, slotPosition: 1),
            SeedLineupEntry(100, 1, 21, LineupEntityType.Constructor, slotPosition: 2)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        var round2 = await ctx
            .LineupEntries.Where(le => le.RaceWeekendId == 2 && le.TeamId == 100)
            .ToListAsync();
        Assert.Equal(5, round2.Count);
    }

    [Fact]
    public async Task AdvanceLineupAsync_ThrowsArgumentException_WhenRaceWeekendDoesNotExist()
    {
        using var ctx = CreateInMemoryContext();
        var service = CreateServiceWithContext(ctx);

        await Assert.ThrowsAsync<ArgumentException>(() => service.AdvanceLineupAsync(999));
    }

    [Fact]
    public async Task AdvanceLineupAsync_LogsEndOfSeasonPath()
    {
        using var ctx = CreateInMemoryContext();
        ctx.Circuits.Add(SeedCircuit(1));
        ctx.RaceWeekends.Add(SeedRace(id: 1, round: 1));
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        VerifyLogged(LogLevel.Information, Times.Once());
    }

    [Fact]
    public async Task AdvanceLineupAsync_LogsNoRowsToCopyPath()
    {
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        VerifyLogged(LogLevel.Information, Times.Once());
    }

    [Fact]
    public async Task AdvanceLineupAsync_LogsAdvancedLineupsOnHappyPath()
    {
        using var ctx = CreateInMemoryContext();
        await SeedTwoRoundsAsync(ctx, nextLockDeadline: DateTime.UtcNow.AddDays(7));

        ctx.LineupEntries.Add(
            SeedLineupEntry(100, 1, 10, LineupEntityType.Driver, slotPosition: 1)
        );
        await ctx.SaveChangesAsync();

        var service = CreateServiceWithContext(ctx);
        await service.AdvanceLineupAsync(1);

        VerifyLogged(LogLevel.Information, Times.Once());
    }

    private void VerifyLogged(LogLevel level, Times times)
    {
        _mockLogger.Verify(
            x =>
                x.Log(
                    level,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => true),
                    It.IsAny<Exception?>(),
                    It.IsAny<Func<It.IsAnyType, Exception?, string>>()
                ),
            times
        );
    }
}
