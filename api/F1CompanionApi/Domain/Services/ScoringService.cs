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
        DriverRaceResult? race,
        bool isCaptain
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

    public int CalculateDriverQualifyingPoints(DriverQualifyingResult result)
    {
        return ScoringConstants.GetPositionPoints(
            ScoringConstants.QualifyingPositionPoints,
            result.Position
        );
    }

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

    public DriverWeekendScore CalculateDriverWeekendPoints(
        DriverQualifyingResult? qualifying,
        DriverRaceResult? sprint,
        DriverRaceResult? race,
        bool isCaptain
    )
    {
        var driverId = qualifying?.DriverId ?? sprint?.DriverId ?? race?.DriverId ?? 0;
        var qualifyingScore =
            qualifying != null ? (int?)CalculateDriverQualifyingPoints(qualifying) : null;
        var sprintScore = sprint != null ? CalculateDriverSprintPoints(sprint) : null;
        var raceScore = race != null ? CalculateDriverRacePoints(race) : null;

        return new DriverWeekendScore(driverId, qualifyingScore, sprintScore, raceScore, isCaptain);
    }

    public ConstructorWeekendScore CalculateConstructorWeekendPoints(
        int constructorId,
        DriverWeekendScore driver1,
        DriverWeekendScore driver2
    )
    {
        return new ConstructorWeekendScore(constructorId, driver1, driver2);
    }

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

        var driverScores = driverEntries
            .Select(entry =>
                ScoreDriver(entry.EntityId, entry.IsCaptain, qualifyingResults, raceResults)
            )
            .ToList();

        var constructorScores = await ScoreConstructorsAsync(
            constructorEntries,
            race!.SeasonId,
            qualifyingResults,
            raceResults,
            driverScores
        );

        return new TeamRaceScoreBreakdown(teamId, raceId, driverScores, constructorScores);
    }

    private DriverWeekendScore ScoreDriver(
        int driverId,
        bool isCaptain,
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

        return CalculateDriverWeekendPoints(qualifying, sprint, raceResult, isCaptain);
    }

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
                    ?? ScoreDriver(sd.DriverId, isCaptain: false, qualifyingResults, raceResults)
                )
                .ToList();

            var driver1 =
                drivers.ElementAtOrDefault(0) ?? new DriverWeekendScore(0, null, null, null, false);
            var driver2 =
                drivers.ElementAtOrDefault(1) ?? new DriverWeekendScore(0, null, null, null, false);

            constructorScores.Add(
                CalculateConstructorWeekendPoints(constructorId, driver1, driver2)
            );
        }

        return constructorScores;
    }

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
