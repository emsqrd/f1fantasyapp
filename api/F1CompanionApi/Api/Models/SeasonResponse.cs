namespace F1CompanionApi.Api.Models;

public class SeasonResponse
{
    public required int Id { get; set; }
    public required int Year { get; set; }
    public required DateTime StartDate { get; set; }
    public required DateTime EndDate { get; set; }
    public required bool? IsCurrent { get; set; }
}
