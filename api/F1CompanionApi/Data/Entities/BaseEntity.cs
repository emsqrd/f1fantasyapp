namespace F1CompanionApi.Data.Entities;

/// <summary>
/// Base class for all entities providing common properties for tracking and soft deletes.
/// Use this directly for reference/catalog data (Drivers, Constructors, Seasons).
/// For user-owned entities, use UserOwnedEntity which extends this with audit fields.
/// </summary>
public abstract class BaseEntity
{
    public int Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }
    public bool IsDeleted { get; set; }
}
