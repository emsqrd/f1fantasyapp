using System.Collections.Frozen;
using F1CompanionApi.Data;
using F1CompanionApi.Data.Entities;
using F1CompanionApi.Domain.Constants;
using F1CompanionApi.Domain.Models;

namespace F1CompanionApi.Domain.Services;

public interface IScoringService
{
    int CalculateDriverQualifyingPoints(DriverQualifyingResult result);
    DriverSessionScore CalculateDriverSprintPoints(DriverRaceResult result);
    DriverSessionScore CalculateDriverRacePoints(
        DriverRaceResult result,
        bool qualifyingOccurred = true
    );
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
            ScoringConstants.SprintDnfPenalty,
            qualifyingOccurred: true
        );
    }

    public DriverSessionScore CalculateDriverRacePoints(
        DriverRaceResult result,
        bool qualifyingOccurred = true
    )
    {
        return CalculateSessionPoints(
            result,
            "Race",
            ScoringConstants.RacePositionPoints,
            ScoringConstants.RaceFastestLapBonus,
            ScoringConstants.RaceDnfPenalty,
            qualifyingOccurred
        );
    }

    private static DriverSessionScore CalculateSessionPoints(
        DriverRaceResult result,
        string sessionName,
        FrozenDictionary<int, int> positionTable,
        int fastestLapBonus,
        int dnfPenalty,
        bool qualifyingOccurred
    )
    {
        var fastestLapPoints = result.FastestLap ? fastestLapBonus : 0;
        var overtakePoints = result.Overtakes;

        if (result.Status == RaceStatus.Classified)
        {
            var finishPosition = result.FinishPosition ?? result.GridPosition;
            var positionPoints = ScoringConstants.GetPositionPoints(positionTable, finishPosition);
            var positionChangePoints = qualifyingOccurred
                ? result.GridPosition - finishPosition
                : 0;

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
