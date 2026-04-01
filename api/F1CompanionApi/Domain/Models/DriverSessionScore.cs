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
    public int Total =>
        PositionPoints + PositionChangePoints + OvertakePoints + FastestLapPoints + PenaltyPoints;

    public static DriverSessionScore Empty(int driverId, string sessionName) =>
        new(driverId, sessionName, 0, 0, 0, 0, 0);
}
