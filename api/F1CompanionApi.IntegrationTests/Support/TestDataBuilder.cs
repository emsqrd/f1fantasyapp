using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;

namespace F1CompanionApi.IntegrationTests.Support;

/// <summary>
/// Async seeding helpers for the most common test fixtures. Adapted from the
/// private helpers in F1CompanionApi.UnitTests.Services.TeamServiceTests so
/// integration tests don't have to reach across projects.
/// </summary>
public static class TestDataBuilder
{
    public static async Task<Season> CreateCurrentSeasonAsync(
        this ApplicationDbContext db,
        int? year = null
    )
    {
        var now = DateTime.UtcNow;
        var season = new Season
        {
            Year = year ?? now.Year,
            StartDate = now.AddDays(-30),
            EndDate = now.AddDays(300),
        };
        db.Seasons.Add(season);
        await db.SaveChangesAsync();
        return season;
    }

    public static async Task<Team> CreateTeamAsync(
        this ApplicationDbContext db,
        int userId,
        string name = "Test Team"
    )
    {
        var team = new Team
        {
            Name = name,
            UserId = userId,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow,
        };
        db.Teams.Add(team);
        await db.SaveChangesAsync();
        return team;
    }

    public static async Task<Driver> CreateDriverAsync(
        this ApplicationDbContext db,
        string abbreviation,
        string firstName,
        string lastName,
        decimal price = 1_000_000m
    )
    {
        var driver = new Driver
        {
            FirstName = firstName,
            LastName = lastName,
            Abbreviation = abbreviation,
            CountryAbbreviation = "NL",
            Price = price,
        };
        db.Drivers.Add(driver);
        await db.SaveChangesAsync();
        return driver;
    }

    public static async Task<Constructor> CreateConstructorAsync(
        this ApplicationDbContext db,
        string name,
        decimal price = 1_000_000m
    )
    {
        var constructor = new Constructor
        {
            Name = name,
            FullName = $"{name} F1 Team",
            Abbreviation =
                name.Length >= 3 ? name[..3].ToUpperInvariant() : name.ToUpperInvariant(),
            CountryAbbreviation = "AT",
            Price = price,
        };
        db.Constructors.Add(constructor);
        await db.SaveChangesAsync();
        return constructor;
    }

    public static async Task<Circuit> CreateCircuitAsync(
        this ApplicationDbContext db,
        string name = "Test Circuit"
    )
    {
        var circuit = new Circuit
        {
            Name = name,
            Location = "Test",
            Country = "Test Country",
        };
        db.Circuits.Add(circuit);
        await db.SaveChangesAsync();
        return circuit;
    }

    public static async Task<RaceWeekend> CreateRaceWeekendAsync(
        this ApplicationDbContext db,
        int seasonId,
        DateTime raceDate,
        DateTime? lockDeadline = null,
        int round = 1,
        int? circuitId = null,
        string name = "Test Grand Prix",
        DateTime? scoredAt = null
    )
    {
        if (circuitId is null)
        {
            var circuit = await db.CreateCircuitAsync($"Circuit {Guid.NewGuid():N}");
            circuitId = circuit.Id;
        }

        var race = new RaceWeekend
        {
            SeasonId = seasonId,
            Round = round,
            Name = name,
            CircuitId = circuitId.Value,
            RaceDate = raceDate,
            LockDeadline = lockDeadline,
            ScoredAt = scoredAt,
        };
        db.RaceWeekends.Add(race);
        await db.SaveChangesAsync();
        return race;
    }
}
