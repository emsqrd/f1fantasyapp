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
        DriverQualifyingResult? qualifying,
        DriverRaceResult? sprint,
        DriverRaceResult? race
    );
    ConstructorWeekendScore CalculateConstructorWeekendPoints(
        int constructorId,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    );
    Task<TeamRaceScoreBreakdown> CalculateTeamRaceScoreAsync(int teamId, int raceId);
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
    public int CalculateDriverQualifyingPoints(DriverQualifyingResult result)
    {
        return ScoringConstants.GetPositionPoints(
            ScoringConstants.QualifyingPositionPoints,
            result.Position
        );
    }

    /// <summary>
    /// Scores a driver's sprint session result.
    /// </summary>
    /// <param name="result">The driver's sprint result, including finish position, grid position, and status.</param>
    public DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result)
    {
        return CalculateSessionPoints(
            result,
            "Sprint",
            ScoringConstants.SprintPositionPoints,
            ScoringConstants.SprintFastestLapBonus,
            ScoringConstants.SprintDnfPenalty
        );
    }

    /// <summary>
    /// Scores a driver's race session result.
    /// </summary>
    /// <param name="result">The driver's race result, including finish position, grid position, and status.</param>
    public DriverSessionScore CalculateDriverRacePoints(DriverRaceResult result)
    {
        return CalculateSessionPoints(
            result,
            "Race",
            ScoringConstants.RacePositionPoints,
            ScoringConstants.RaceFastestLapBonus,
            ScoringConstants.RaceDnfPenalty
        );
    }

    /// <summary>
    /// Assembles a full weekend score from up to three session results.
    /// Any session may be null when it was not contested (e.g. no sprint weekend).
    /// </summary>
    /// <param name="qualifying">The driver's qualifying result, or null if qualifying data is unavailable.</param>
    /// <param name="sprint">The driver's sprint result, or null if the weekend has no sprint.</param>
    /// <param name="race">The driver's race result, or null if race data is unavailable.</param>
    public DriverWeekendScore CalculateDriverWeekendPoints(
        DriverQualifyingResult? qualifying,
        DriverRaceResult? sprint,
        DriverRaceResult? race
    )
    {
        var driverId = qualifying?.DriverId ?? sprint?.DriverId ?? race?.DriverId ?? 0;
        var qualifyingScore =
            qualifying != null ? (int?)CalculateDriverQualifyingPoints(qualifying) : null;
        var sprintScore = sprint != null ? CalculateDriverSprintPoints(sprint) : null;
        var raceScore = race != null ? CalculateDriverRacePoints(race) : null;

        return new DriverWeekendScore(driverId, qualifyingScore, sprintScore, raceScore);
    }

    /// <summary>
    /// Combines two driver weekend scores under a constructor entry.
    /// </summary>
    /// <param name="constructorId">The constructor being scored.</param>
    /// <param name="driver1">Weekend score for the constructor's first driver.</param>
    /// <param name="driver2">Weekend score for the constructor's second driver.</param>
    public ConstructorWeekendScore CalculateConstructorWeekendPoints(
        int constructorId,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    )
    {
        return new ConstructorWeekendScore(constructorId, driver1, driver2);
    }

    /// <summary>
    /// Fetches all race data for the given team, scores every driver and constructor entry,
    /// and returns the full session-by-session breakdown.
    /// </summary>
    /// <param name="teamId">The fantasy team to score.</param>
    /// <param name="raceId">The race weekend to score against.</param>
    public async Task<TeamRaceScoreBreakdown> CalculateTeamRaceScoreAsync(int teamId, int raceId)
    {
        var lineupEntries = await _dbContext
            .LineupEntries.Where(le => le.TeamId == teamId && le.RaceId == raceId)
            .ToListAsync();

        var race = await _dbContext.Races.FindAsync(raceId);

        var qualifyingResults = await _dbContext
            .DriverQualifyingResults.Where(dqr => dqr.RaceId == raceId)
            .ToListAsync();

        var raceResults = await _dbContext
            .DriverRaceResults.Where(drr => drr.RaceId == raceId)
            .ToListAsync();

        var driverEntries = lineupEntries
            .Where(le => le.EntityType == LineupEntityType.Driver)
            .ToList();

        var constructorEntries = lineupEntries
            .Where(le => le.EntityType == LineupEntityType.Constructor)
            .ToList();

        var teamDriverScores = driverEntries
            .Select(entry => new TeamDriverScore(
                ScoreDriver(entry.EntityId, qualifyingResults, raceResults),
                entry.IsCaptain
            ))
            .ToList();

        var entityDriverScores = teamDriverScores.Select(tds => tds.EntityScore).ToList();

        var constructorScores = await ScoreConstructorsAsync(
            constructorEntries,
            race!.SeasonId,
            qualifyingResults,
            raceResults,
            entityDriverScores
        );

        return new TeamRaceScoreBreakdown(teamId, raceId, teamDriverScores, constructorScores);
    }

    /// <summary>
    /// Resolves a driver's session results from the race weekend data and returns their full weekend score.
    /// </summary>
    /// <param name="driverId">The driver to score.</param>
    /// <param name="qualifyingResults">All qualifying results for the race weekend.</param>
    /// <param name="raceResults">All race-type results (sprint and race) for the weekend.</param>
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

        return CalculateDriverWeekendPoints(qualifying, sprint, raceResult);
    }

    /// <summary>
    /// Scores each constructor entry. Reuses already-computed driver scores where available
    /// to avoid redundant calculation; scores any remaining drivers from the raw result sets.
    /// </summary>
    /// <param name="constructorEntries">The constructor lineup entries to score.</param>
    /// <param name="seasonId">Used to look up which drivers are active for each constructor.</param>
    /// <param name="qualifyingResults">All qualifying results for the race weekend.</param>
    /// <param name="raceResults">All race-type results (sprint and race) for the weekend.</param>
    /// <param name="driverScores">Already-computed driver scores to reuse before falling back to raw results.</param>
    private async Task<List<ConstructorWeekendScore>> ScoreConstructorsAsync(
        List<LineupEntry> constructorEntries,
        int seasonId,
        List<DriverQualifyingResult> qualifyingResults,
        List<DriverRaceResult> raceResults,
        List<DriverWeekendScore> driverScores
    )
    {
        var constructorIds = constructorEntries.Select(ce => ce.EntityId).ToList();
        var seasonDrivers = await _dbContext
            .SeasonDrivers.Where(sd =>
                sd.SeasonId == seasonId && sd.IsActive && constructorIds.Contains(sd.ConstructorId)
            )
            .ToListAsync();

        var constructorScores = new List<ConstructorWeekendScore>();

        foreach (var entry in constructorEntries)
        {
            var constructorId = entry.EntityId;
            var drivers = seasonDrivers
                .Where(sd => sd.ConstructorId == constructorId)
                .Select(sd =>
                    driverScores.FirstOrDefault(ds => ds.DriverId == sd.DriverId)
                    ?? ScoreDriver(sd.DriverId, qualifyingResults, raceResults)
                )
                .ToList();

            var driver1 = drivers[0];
            var driver2 = drivers[1];

            constructorScores.Add(
                CalculateConstructorWeekendPoints(constructorId, driver1, driver2)
            );
        }

        return constructorScores;
    }

    /// <summary>
    /// Applies the scoring rules for a race-type session, handling classified finishers and DNFs differently.
    /// </summary>
    /// <param name="result">The driver's result for this session.</param>
    /// <param name="sessionName">Display name used to label the returned score (e.g. "Sprint", "Race").</param>
    /// <param name="positionTable">Points awarded per finishing position for this session type.</param>
    /// <param name="fastestLapBonus">Bonus points awarded for setting the fastest lap.</param>
    /// <param name="dnfPenalty">Penalty points applied when the driver does not finish classified.</param>
    private static DriverSessionScore CalculateSessionPoints(
        DriverRaceResult result,
        string sessionName,
        FrozenDictionary<int, int> positionTable,
        int fastestLapBonus,
        int dnfPenalty
    )
    {
        var fastestLapPoints = result.FastestLap ? fastestLapBonus : 0;
        var overtakePoints = result.Overtakes;

        if (result.Status == RaceStatus.Classified)
        {
            var finishPosition = result.FinishPosition ?? result.GridPosition;
            var positionPoints = ScoringConstants.GetPositionPoints(positionTable, finishPosition);
            var positionChangePoints = result.GridPosition - finishPosition;

            return new DriverSessionScore(
                result.DriverId,
                sessionName,
                positionPoints,
                positionChangePoints,
                overtakePoints,
                fastestLapPoints,
                0
            );
        }

        return new DriverSessionScore(
            result.DriverId,
            sessionName,
            0,
            0,
            overtakePoints,
            fastestLapPoints,
            dnfPenalty
        );
    }
}
