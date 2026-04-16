namespace F1CompanionApi.Api.Models;

public class CircuitResponse
{
    public required int Id { get; set; }
    public required string Name { get; set; }
    public required string Location { get; set; }
    public required string Country { get; set; }
}
