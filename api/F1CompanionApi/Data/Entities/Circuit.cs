namespace F1CompanionApi.Data.Entities;

public class Circuit : BaseEntity
{
    public required string Name { get; set; }
    public required string Location { get; set; }
    public required string Country { get; set; }
}
