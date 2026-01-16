using F1CompanionApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    // Add your DbSets here
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Constructor> Constructors => Set<Constructor>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<League> Leagues => Set<League>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamDriver> TeamDrivers => Set<TeamDriver>();
    public DbSet<TeamConstructor> TeamConstructors => Set<TeamConstructor>();
    public DbSet<LeagueTeam> LeagueTeams => Set<LeagueTeam>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Account>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(36); // UUID length
        });

        modelBuilder.Entity<League>()
            .HasOne(e => e.Owner)
            .WithMany()
            .HasForeignKey(e => e.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<UserProfile>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.AccountId).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
            entity
                .HasOne(e => e.Account)
                .WithOne(e => e.Profile)
                .HasForeignKey<UserProfile>(e => e.AccountId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Team>(entity =>
        {
            entity.HasIndex(e => e.UserId).IsUnique();
            entity
                .HasOne(e => e.Owner)
                .WithOne(u => u.Team)
                .HasForeignKey<Team>(e => e.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure LeagueTeam (many-to-many join table)
        modelBuilder.Entity<LeagueTeam>(entity =>
        {
            entity
                .HasOne(lt => lt.League)
                .WithMany(l => l.LeagueTeams)
                .HasForeignKey(lt => lt.LeagueId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(lt => lt.Team)
                .WithMany(t => t.LeagueTeams)
                .HasForeignKey(lt => lt.TeamId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Configure TeamDriver relationships
        modelBuilder.Entity<TeamDriver>(entity =>
        {
            entity
                .HasOne(td => td.Team)
                .WithMany(t => t.TeamDrivers)
                .HasForeignKey(td => td.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(td => td.Driver)
                .WithMany()
                .HasForeignKey(td => td.DriverId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure TeamConstructor relationships
        modelBuilder.Entity<TeamConstructor>(entity =>
        {
            entity
                .HasOne(tc => tc.Team)
                .WithMany(t => t.TeamConstructors)
                .HasForeignKey(tc => tc.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(tc => tc.Constructor)
                .WithMany()
                .HasForeignKey(tc => tc.ConstructorId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure audit trail FK for user-owned entities only
        ConfigureAuditTrailForeignKeys<League>(modelBuilder);
        ConfigureAuditTrailForeignKeys<Team>(modelBuilder);
        ConfigureAuditTrailForeignKeys<TeamDriver>(modelBuilder);
        ConfigureAuditTrailForeignKeys<TeamConstructor>(modelBuilder);
        ConfigureAuditTrailForeignKeys<LeagueTeam>(modelBuilder);
    }

    private void ConfigureAuditTrailForeignKeys<T>(ModelBuilder modelBuilder)
        where T : UserOwnedEntity
    {
        // Configure foreign key relationships for user-owned entities
        modelBuilder
            .Entity<T>()
            .HasOne(e => e.CreatedByUser)
            .WithMany()
            .HasForeignKey(e => e.CreatedBy)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder
            .Entity<T>()
            .HasOne(e => e.UpdatedByUser)
            .WithMany()
            .HasForeignKey(e => e.UpdatedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);

        modelBuilder
            .Entity<T>()
            .HasOne(e => e.DeletedByUser)
            .WithMany()
            .HasForeignKey(e => e.DeletedBy)
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);
    }
}
