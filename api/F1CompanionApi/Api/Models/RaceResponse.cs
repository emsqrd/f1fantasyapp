namespace F1CompanionApi.Api.Models;

public class RaceResponse
{
    public required int Id { get; set; }
    public required int SeasonId { get; set; }
    public required int Round { get; set; }
    public required string Name { get; set; }
    public required CircuitResponse Circuit { get; set; }
    public required DateTime RaceDate { get; set; }
    public DateTime? LockDeadline { get; set; }
    public required bool IsCurrent { get; set; }
    public bool HasSprint { get; set; }
}
