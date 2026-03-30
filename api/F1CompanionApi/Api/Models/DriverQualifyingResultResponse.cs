namespace F1CompanionApi.Api.Models;

public class DriverQualifyingResultResponse
{
    public required int Id { get; set; }
    public required int DriverId { get; set; }
    public required int RaceId { get; set; }
    public required int Position { get; set; }
}
