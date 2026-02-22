namespace F1CompanionApi.Data.Entities;

public class SeasonDriver : BaseEntity
{
    public int SeasonId { get; set; }
    public Season Season { get; set; } = null!;
    public int DriverId { get; set; }
    public Driver Driver { get; set; } = null!;
    public int ConstructorId { get; set; }
    public Constructor Constructor { get; set; } = null!;
    public bool IsActive { get; set; } = true;
}
