namespace F1CompanionApi.Domain.Models;

public record DriverSessionScore(
    int DriverId,
    string SessionName,
    int PositionPoints,
    int PositionChangePoints,
    int OvertakePoints,
    int FastestLapPoints,
    int PenaltyPoints
)
{
    /// <summary>
    /// Sum of all scoring components for this session.
    /// </summary>
    public int Total =>
        PositionPoints + PositionChangePoints + OvertakePoints + FastestLapPoints + PenaltyPoints;
}
