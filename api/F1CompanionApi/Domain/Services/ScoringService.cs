using System.Collections.Frozen;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Constants;
using F1CompanionApi.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Domain.Services;

public interface IScoringService
{
    int CalculateDriverQualifyingPoints(DriverQualifyingResult result);
    DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result);
    DriverSessionScore CalculateDriverRacePoints(DriverRaceResult result);
    DriverWeekendScore CalculateDriverWeekendPoints(
        int driverId,
        DriverQualifyingResult? qualifying,
        DriverRaceResult? sprint,
        DriverRaceResult? race
    );
    ConstructorWeekendScore CalculateConstructorWeekendPoints(
        int constructorId,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    );
    Task ScoreRaceEntitiesAsync(int raceId);
    Task ScoreTeamsForRaceAsync(int raceId);
}

public class ScoringService : IScoringService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<ScoringService> _logger;

    public ScoringService(ApplicationDbContext dbContext, ILogger<ScoringService> logger)
    {
        ArgumentNullException.ThrowIfNull(dbContext);
        ArgumentNullException.ThrowIfNull(logger);

        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Maps a qualifying result to points based on the driver's grid position.
    /// </summary>
    /// <param name="result">The driver's qualifying result, including their grid position.</param>
    /// <returns>The points earned for the driver's qualifying position.</returns>
    public int CalculateDriverQualifyingPoints(DriverQualifyingResult result)
    {
        return GetPositionPoints(ScoringConstants.QualifyingPositionPoints, result.Position);
    }

    /// <summary>
    /// Scores a driver's sprint session result.
    /// </summary>
    /// <param name="result">The driver's sprint result.</param>
    /// <returns>The driver's point breakdown for the sprint.</returns>
    public DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result)
    {
        return CalculateDriverSessionPoints(
            result,
            ScoringConstants.SprintPositionPoints,
            ScoringConstants.SprintFastestLapBonus,
            ScoringConstants.SprintOvertakeBonus,
            ScoringConstants.SprintDnfPenalty
        );
    }

    /// <summary>
    /// Scores a driver's race session result.
    /// </summary>
    /// <param name="result">The driver's race result.</param>
    /// <returns>The driver's point breakdown for the race.</returns>
    public DriverSessionScore CalculateDriverRacePoints(DriverRaceResult result)
    {
        return CalculateDriverSessionPoints(
            result,
            ScoringConstants.RacePositionPoints,
            ScoringConstants.RaceFastestLapBonus,
            ScoringConstants.RaceOvertakeBonus,
            ScoringConstants.RaceDnfPenalty
        );
    }

    /// <summary>
    /// Applies the scoring rules for a race-type session.
    /// </summary>
    /// <param name="result">The driver's result for this session.</param>
    /// <param name="positionTable">Points awarded per finishing position for this session type.</param>
    /// <param name="fastestLapBonus">Bonus points awarded for setting the fastest lap.</param>
    /// <param name="overtakeBonus">Points awarded per on-track overtakes gained.</param>
    /// <param name="dnfPenalty">Penalty points applied when the driver does not finish classified.</param>
    /// <returns>The driver's point breakdown for the session.</returns>
    private static DriverSessionScore CalculateDriverSessionPoints(
        DriverRaceResult result,
        FrozenDictionary<int, int> positionTable,
        int fastestLapBonus,
        int overtakeBonus,
        int dnfPenalty
    )
    {
        var fastestLapPoints = result.FastestLap ? fastestLapBonus : 0;
        var overtakePoints = result.Overtakes * overtakeBonus;
        var positionPoints = GetPositionPoints(positionTable, result.FinishPosition);
        var positionChangePoints =
            result.GridPosition - (result.FinishPosition ?? result.GridPosition);
        var penalty = 0;

        if (result.Status != RaceStatus.Classified)
        {
            positionPoints = 0;
            positionChangePoints = 0;
            penalty = dnfPenalty;
        }

        return new DriverSessionScore(
            positionPoints,
            positionChangePoints,
            overtakePoints,
            fastestLapPoints,
            penalty
        );
    }

    /// <summary>
    /// Looks up the points value for a given finishing position.
    /// </summary>
    /// <param name="pointsByPosition">The position-to-points mapping for the session type.</param>
    /// <param name="position">The finishing position to look up, or null if the driver did not finish.</param>
    /// <returns>The points for the given position, or zero if the position is unscored.</returns>
    private static int GetPositionPoints(FrozenDictionary<int, int> pointsByPosition, int? position)
    {
        if (!position.HasValue)
            return 0;

        return pointsByPosition.GetValueOrDefault(position.Value);
    }

    /// <summary>
    /// Assembles a full weekend driver score.
    /// </summary>
    /// <param name="driverId">The driver being scored.</param>
    /// <param name="qualifying">The driver's qualifying result.</param>
    /// <param name="sprint">The driver's sprint result.</param>
    /// <param name="race">The driver's race result.</param>
    /// <returns>The driver's combined score across all sessions contested that weekend.</returns>
    public DriverWeekendScore CalculateDriverWeekendPoints(
        int driverId,
        DriverQualifyingResult? qualifying,
        DriverRaceResult? sprint,
        DriverRaceResult? race
    )
    {
        int? qualifyingScore =
            qualifying != null ? CalculateDriverQualifyingPoints(qualifying) : null;
        var sprintScore = sprint != null ? CalculateDriverSprintPoints(sprint) : null;
        var raceScore = race != null ? CalculateDriverRacePoints(race) : null;

        return new DriverWeekendScore(driverId, qualifyingScore, sprintScore, raceScore);
    }

    /// <summary>
    /// Assembles a full weekend constructor score.
    /// </summary>
    /// <param name="constructorId">The constructor being scored.</param>
    /// <param name="driver1">Weekend score for the constructor's first driver.</param>
    /// <param name="driver2">Weekend score for the constructor's second driver.</param>
    /// <returns>The constructor's combined score from both drivers across the weekend.</returns>
    public ConstructorWeekendScore CalculateConstructorWeekendPoints(
        int constructorId,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    )
    {
        var qualifying =
            driver1.Qualifying.HasValue || driver2.Qualifying.HasValue
                ? (driver1.Qualifying ?? 0) + (driver2.Qualifying ?? 0)
                : (int?)null;

        return new ConstructorWeekendScore(
            constructorId,
            qualifying,
            SumDriverSessions(driver1.Sprint, driver2.Sprint),
            SumDriverSessions(driver1.Race, driver2.Race)
        );
    }

    /// <summary>
    /// Combines two driver session scores into a single aggregated score for the session.
    /// </summary>
    /// <param name="driver1">The first driver's session score, or null if they did not participate.</param>
    /// <param name="driver2">The second driver's session score, or null if they did not participate.</param>
    /// <returns>The combined session score, or null if neither driver participated.</returns>
    private static DriverSessionScore? SumDriverSessions(
        DriverSessionScore? driver1,
        DriverSessionScore? driver2
    )
    {
        if (driver1 is null && driver2 is null)
            return null;

        var d1 = driver1 ?? DriverSessionScore.Empty;
        var d2 = driver2 ?? DriverSessionScore.Empty;

        return new DriverSessionScore(
            d1.PositionPoints + d2.PositionPoints,
            d1.PositionChangePoints + d2.PositionChangePoints,
            d1.OvertakePoints + d2.OvertakePoints,
            d1.FastestLapPoints + d2.FastestLapPoints,
            d1.PenaltyPoints + d2.PenaltyPoints
        );
    }

    /// <summary>
    /// Scores every driver and constructor for a race weekend.
    /// </summary>
    /// <param name="raceId">The race to score.</param>
    public async Task ScoreRaceEntitiesAsync(int raceId)
    {
        _logger.LogInformation("Scoring entities for race {RaceId}", raceId);

        var race =
            await _dbContext.Races.FindAsync(raceId)
            ?? throw new InvalidOperationException($"Race {raceId} not found.");

        var qualifyingResults = await _dbContext
            .DriverQualifyingResults.Where(dqr => dqr.RaceId == raceId)
            .ToListAsync();

        var raceResults = await _dbContext
            .DriverRaceResults.Where(drr => drr.RaceId == raceId)
            .ToListAsync();

        var seasonDrivers = await _dbContext
            .SeasonDrivers.Where(sd => sd.SeasonId == race.SeasonId && sd.IsActive)
            .ToListAsync();

        var driverScores = ScoreDrivers(qualifyingResults, raceResults);
        var constructorScores = ScoreConstructors(seasonDrivers, driverScores, raceId);

        await SaveDriverAndConstructorScores(raceId, driverScores, constructorScores);

        _logger.LogInformation(
            "Scored {DriverCount} drivers and {ConstructorCount} constructors for race {RaceId}",
            driverScores.Count,
            constructorScores.Count,
            raceId
        );
    }

    /// <summary>
    /// Scores every driver who appears in either the qualifying or race results for the weekend,
    /// returning one weekend score per driver.
    /// </summary>
    /// <param name="qualifyingResults">All qualifying results for the race weekend.</param>
    /// <param name="raceResults">All race-type results (sprint and race) for the weekend.</param>
    /// <returns>One weekend score for each driver who appeared in the results.</returns>
    private List<DriverWeekendScore> ScoreDrivers(
        List<DriverQualifyingResult> qualifyingResults,
        List<DriverRaceResult> raceResults
    )
    {
        var driverIds = qualifyingResults
            .Select(qr => qr.DriverId)
            .Union(raceResults.Select(rr => rr.DriverId));

        return driverIds.Select(id => ScoreDriver(id, qualifyingResults, raceResults)).ToList();
    }

    /// <summary>
    /// Scores a driver based on their weekend results.
    /// </summary>
    /// <param name="driverId">The driver to score.</param>
    /// <param name="qualifyingResults">All qualifying results for the race weekend.</param>
    /// <param name="raceResults">All race-type results (sprint and race) for the weekend.</param>
    /// <returns>The driver's full weekend score.</returns>
    private DriverWeekendScore ScoreDriver(
        int driverId,
        List<DriverQualifyingResult> qualifyingResults,
        List<DriverRaceResult> raceResults
    )
    {
        var qualifying = qualifyingResults.FirstOrDefault(qr => qr.DriverId == driverId);
        var sprint = raceResults.FirstOrDefault(rr =>
            rr.DriverId == driverId && rr.SessionType == SessionType.Sprint
        );
        var raceResult = raceResults.FirstOrDefault(rr =>
            rr.DriverId == driverId && rr.SessionType == SessionType.Race
        );

        return CalculateDriverWeekendPoints(driverId, qualifying, sprint, raceResult);
    }

    /// <summary>
    /// Builds a combined weekend score for each constructor from their two drivers' individual scores.
    /// </summary>
    /// <param name="seasonDrivers">The active season drivers, used to determine constructor pairings.</param>
    /// <param name="driverScores">The pre-computed weekend scores for each driver.</param>
    /// <param name="raceId">The race being scored, included in any error messages raised.</param>
    /// <returns>One weekend score for each constructor.</returns>
    private List<ConstructorWeekendScore> ScoreConstructors(
        List<SeasonDriver> seasonDrivers,
        List<DriverWeekendScore> driverScores,
        int raceId
    )
    {
        var scores = new List<ConstructorWeekendScore>();

        foreach (var constructor in seasonDrivers.GroupBy(sd => sd.ConstructorId))
        {
            var constructorId = constructor.Key;
            var driversWithScores = constructor
                .Select(driver =>
                    driverScores.FirstOrDefault(score => score.DriverId == driver.DriverId)
                )
                .OfType<DriverWeekendScore>()
                .ToList();

            if (driversWithScores.Count != 2)
            {
                throw new InvalidOperationException(
                    $"Constructor {constructorId} does not have results for both drivers in race {raceId}. "
                        + "Update SeasonDrivers before rescoring."
                );
            }

            scores.Add(
                CalculateConstructorWeekendPoints(
                    constructorId,
                    driversWithScores[0],
                    driversWithScores[1]
                )
            );
        }

        return scores;
    }

    /// <summary>
    /// Replaces any existing driver and constructor scores for the race with the newly computed
    /// values. All deletes and inserts are committed in a single save, making the operation atomic.
    /// </summary>
    /// <param name="raceId">The race whose scores are being replaced.</param>
    /// <param name="driverScores">The computed weekend scores for each driver.</param>
    /// <param name="constructorScores">The computed weekend scores for each constructor.</param>
    private async Task SaveDriverAndConstructorScores(
        int raceId,
        IEnumerable<DriverWeekendScore> driverScores,
        List<ConstructorWeekendScore> constructorScores
    )
    {
        _dbContext.DriverRaceScores.RemoveRange(
            await _dbContext.DriverRaceScores.Where(d => d.RaceId == raceId).ToListAsync()
        );
        _dbContext.ConstructorRaceScores.RemoveRange(
            await _dbContext.ConstructorRaceScores.Where(c => c.RaceId == raceId).ToListAsync()
        );

        _dbContext.DriverRaceScores.AddRange(
            driverScores.Select(s => MapToDriverRaceScore(s, raceId))
        );
        _dbContext.ConstructorRaceScores.AddRange(
            constructorScores.Select(s => MapToConstructorRaceScore(s, raceId))
        );

        await _dbContext.SaveChangesAsync();
    }

    /// <summary>
    /// Maps a driver's weekend score to the entity record.
    /// </summary>
    /// <param name="score">The driver's computed weekend score.</param>
    /// <param name="raceId">The race the score belongs to.</param>
    /// <returns>The driver's race score record, ready to be saved.</returns>
    private static DriverRaceScore MapToDriverRaceScore(DriverWeekendScore score, int raceId) =>
        new()
        {
            DriverId = score.DriverId,
            RaceId = raceId,
            QualifyingPositionPoints = score.Qualifying,
            SprintPositionPoints = score.Sprint?.PositionPoints,
            SprintPositionChangePoints = score.Sprint?.PositionChangePoints,
            SprintOvertakePoints = score.Sprint?.OvertakePoints,
            SprintFastestLapPoints = score.Sprint?.FastestLapPoints,
            SprintPenaltyPoints = score.Sprint?.PenaltyPoints,
            SprintTotal = score.Sprint?.Total,
            RacePositionPoints = score.Race?.PositionPoints,
            RacePositionChangePoints = score.Race?.PositionChangePoints,
            RaceOvertakePoints = score.Race?.OvertakePoints,
            RaceFastestLapPoints = score.Race?.FastestLapPoints,
            RacePenaltyPoints = score.Race?.PenaltyPoints,
            RaceTotal = score.Race?.Total,
            TotalPoints = score.TotalPoints,
            CalculatedAt = DateTime.UtcNow,
        };

    /// <summary>
    /// Maps a constructor's weekend score to the entity record.
    /// </summary>
    /// <param name="score">The constructor's computed weekend score.</param>
    /// <param name="raceId">The race the score belongs to.</param>
    /// <returns>The constructor's race score record, ready to be saved.</returns>
    private static ConstructorRaceScore MapToConstructorRaceScore(
        ConstructorWeekendScore score,
        int raceId
    ) =>
        new()
        {
            ConstructorId = score.ConstructorId,
            RaceId = raceId,
            QualifyingPositionPoints = score.Qualifying,
            SprintPositionPoints = score.Sprint?.PositionPoints,
            SprintPositionChangePoints = score.Sprint?.PositionChangePoints,
            SprintOvertakePoints = score.Sprint?.OvertakePoints,
            SprintFastestLapPoints = score.Sprint?.FastestLapPoints,
            SprintPenaltyPoints = score.Sprint?.PenaltyPoints,
            SprintTotal = score.Sprint?.Total,
            RacePositionPoints = score.Race?.PositionPoints,
            RacePositionChangePoints = score.Race?.PositionChangePoints,
            RaceOvertakePoints = score.Race?.OvertakePoints,
            RaceFastestLapPoints = score.Race?.FastestLapPoints,
            RacePenaltyPoints = score.Race?.PenaltyPoints,
            RaceTotal = score.Race?.Total,
            TotalPoints = score.Total,
            CalculatedAt = DateTime.UtcNow,
        };

    /// <summary>
    /// Assembles and saves team scores for a race.
    /// </summary>
    /// <param name="raceId">The race to score teams for.</param>
    public async Task ScoreTeamsForRaceAsync(int raceId)
    {
        _logger.LogInformation("Scoring teams for race {RaceId}", raceId);

        var driverRaceScores = await _dbContext
            .DriverRaceScores.Where(drs => drs.RaceId == raceId)
            .ToListAsync();

        var constructorRaceScores = await _dbContext
            .ConstructorRaceScores.Where(crs => crs.RaceId == raceId)
            .ToListAsync();

        var lineupEntries = await _dbContext
            .LineupEntries.Where(le => le.RaceId == raceId)
            .ToListAsync();

        var teamScores = new List<TeamRaceScore>();

        foreach (var team in lineupEntries.GroupBy(le => le.TeamId))
        {
            var totalPoints = team.Sum(entry =>
                GetLineupEntryPoints(entry, driverRaceScores, constructorRaceScores)
            );

            teamScores.Add(
                new TeamRaceScore
                {
                    TeamId = team.Key,
                    RaceId = raceId,
                    TotalPoints = totalPoints,
                    CalculatedAt = DateTime.UtcNow,
                }
            );
        }

        var existingTeamScores = await _dbContext
            .TeamRaceScores.Where(trs => trs.RaceId == raceId)
            .ToListAsync();

        _dbContext.TeamRaceScores.RemoveRange(existingTeamScores);

        _dbContext.TeamRaceScores.AddRange(teamScores);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation(
            "Scored {TeamCount} teams for race {RaceId}",
            teamScores.Count,
            raceId
        );
    }

    /// <summary>
    /// Returns the score for a driver or constructor lineup entry.
    /// </summary>
    /// <param name="entry">The lineup entry identifying the driver or constructor and whether they are captain.</param>
    /// <param name="driverScores">All driver scores for the race, used to look up the entry's total.</param>
    /// <param name="constructorScores">All constructor scores for the race, used to look up the entry's total.</param>
    /// <returns>The entry's total points, with the captain multiplier applied if applicable.</returns>
    private static int GetLineupEntryPoints(
        LineupEntry entry,
        List<DriverRaceScore> driverScores,
        List<ConstructorRaceScore> constructorScores
    )
    {
        var points = entry.EntityType switch
        {
            LineupEntityType.Driver => driverScores
                .FirstOrDefault(d => d.DriverId == entry.EntityId)
                ?.TotalPoints
                ?? 0,
            LineupEntityType.Constructor => constructorScores
                .FirstOrDefault(c => c.ConstructorId == entry.EntityId)
                ?.TotalPoints
                ?? 0,
            _ => throw new ArgumentOutOfRangeException(nameof(entry), entry.EntityType, null),
        };

        if (entry.IsCaptain)
            points *= ScoringConstants.CaptainMultiplier;

        return points;
    }
}
