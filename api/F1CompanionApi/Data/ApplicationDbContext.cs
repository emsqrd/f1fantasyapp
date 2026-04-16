using F1CompanionApi.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace F1CompanionApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    // Add your DbSets here
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Circuit> Circuits => Set<Circuit>();
    public DbSet<Constructor> Constructors => Set<Constructor>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<League> Leagues => Set<League>();
    public DbSet<LeagueInvite> LeagueInvites => Set<LeagueInvite>();
    public DbSet<LeagueTeam> LeagueTeams => Set<LeagueTeam>();
    public DbSet<RaceWeekend> RaceWeekends => Set<RaceWeekend>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<SeasonConstructor> SeasonConstructors => Set<SeasonConstructor>();
    public DbSet<SeasonDriver> SeasonDrivers => Set<SeasonDriver>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamDriver> TeamDrivers => Set<TeamDriver>();
    public DbSet<TeamConstructor> TeamConstructors => Set<TeamConstructor>();
    public DbSet<LineupEntry> LineupEntries => Set<LineupEntry>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<DriverQualifyingResult> DriverQualifyingResults => Set<DriverQualifyingResult>();
    public DbSet<DriverRacingResult> DriverRacingResults => Set<DriverRacingResult>();
    public DbSet<TeamRaceWeekendScore> TeamRaceWeekendScores => Set<TeamRaceWeekendScore>();
    public DbSet<DriverRaceWeekendScore> DriverRaceWeekendScores => Set<DriverRaceWeekendScore>();
    public DbSet<ConstructorRaceWeekendScore> ConstructorRaceWeekendScores =>
        Set<ConstructorRaceWeekendScore>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Account>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasMaxLength(36); // UUID length
        });

        modelBuilder.Entity<Driver>(entity =>
        {
            entity.Property(e => e.Price).HasDefaultValue(3_000_000m);
        });

        modelBuilder.Entity<Constructor>(entity =>
        {
            entity.Property(e => e.Price).HasDefaultValue(3_000_000m);
        });

        modelBuilder
            .Entity<League>()
            .HasOne(e => e.Owner)
            .WithMany()
            .HasForeignKey(e => e.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<LeagueInvite>(entity =>
        {
            entity
                .HasOne(e => e.League)
                .WithMany()
                .HasForeignKey(e => e.LeagueId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.HasIndex(e => e.LeagueId).IsUnique();
        });

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

        modelBuilder.Entity<RaceWeekend>(entity =>
        {
            entity
                .HasOne(e => e.Season)
                .WithMany(s => s.RaceWeekends)
                .HasForeignKey(e => e.SeasonId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(e => e.Circuit)
                .WithMany()
                .HasForeignKey(e => e.CircuitId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriverQualifyingResult>(entity =>
        {
            entity
                .HasOne(dqr => dqr.Driver)
                .WithMany()
                .HasForeignKey(dqr => dqr.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(dqr => dqr.RaceWeekend)
                .WithMany()
                .HasForeignKey(dqr => dqr.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriverRacingResult>(entity =>
        {
            entity
                .HasOne(drr => drr.Driver)
                .WithMany()
                .HasForeignKey(drr => drr.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(drr => drr.RaceWeekend)
                .WithMany()
                .HasForeignKey(drr => drr.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TeamRaceWeekendScore>(entity =>
        {
            entity
                .HasOne(trws => trws.Team)
                .WithMany()
                .HasForeignKey(trws => trws.TeamId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(trws => trws.RaceWeekend)
                .WithMany()
                .HasForeignKey(trws => trws.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriverRaceWeekendScore>(entity =>
        {
            entity
                .HasOne(drws => drws.Driver)
                .WithMany()
                .HasForeignKey(drws => drws.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(drws => drws.RaceWeekend)
                .WithMany()
                .HasForeignKey(drws => drws.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ConstructorRaceWeekendScore>(entity =>
        {
            entity
                .HasOne(crs => crs.Constructor)
                .WithMany()
                .HasForeignKey(crs => crs.ConstructorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(crs => crs.RaceWeekend)
                .WithMany()
                .HasForeignKey(crs => crs.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SeasonDriver>(entity =>
        {
            entity
                .HasOne(sd => sd.Season)
                .WithMany(s => s.SeasonDrivers)
                .HasForeignKey(sd => sd.SeasonId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(sd => sd.Driver)
                .WithMany()
                .HasForeignKey(sd => sd.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(sd => sd.Constructor)
                .WithMany()
                .HasForeignKey(sd => sd.ConstructorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(sd => new { sd.SeasonId, sd.DriverId }).IsUnique();
        });

        modelBuilder.Entity<SeasonConstructor>(entity =>
        {
            entity
                .HasOne(sc => sc.Season)
                .WithMany(s => s.SeasonConstructors)
                .HasForeignKey(sc => sc.SeasonId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(sc => sc.Constructor)
                .WithMany()
                .HasForeignKey(sc => sc.ConstructorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(sc => new { sc.SeasonId, sc.ConstructorId }).IsUnique();
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

        modelBuilder.Entity<LineupEntry>(entity =>
        {
            entity
                .HasOne(le => le.Team)
                .WithMany()
                .HasForeignKey(le => le.TeamId)
                .OnDelete(DeleteBehavior.Cascade);

            entity
                .HasOne(le => le.RaceWeekend)
                .WithMany()
                .HasForeignKey(le => le.RaceWeekendId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Configure audit trail FK for user-owned entities only
        ConfigureAuditTrailForeignKeys<League>(modelBuilder);
        ConfigureAuditTrailForeignKeys<Team>(modelBuilder);
        ConfigureAuditTrailForeignKeys<TeamDriver>(modelBuilder);
        ConfigureAuditTrailForeignKeys<TeamConstructor>(modelBuilder);
        ConfigureAuditTrailForeignKeys<LeagueTeam>(modelBuilder);
        ConfigureAuditTrailForeignKeys<LeagueInvite>(modelBuilder);
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
