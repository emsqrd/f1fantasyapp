namespace F1CompanionApi.Domain.Models;

public record DriverSessionScore(
    int PositionPoints,
    int PositionChangePoints,
    int OvertakePoints,
    int FastestLapPoints,
    int PenaltyPoints
)
{
    public static readonly DriverSessionScore Empty = new(0, 0, 0, 0, 0);

    /// <summary>
    /// Sum of all scoring components for this session.
    /// </summary>
    public int Total =>
        PositionPoints + PositionChangePoints + OvertakePoints + FastestLapPoints + PenaltyPoints;
}
