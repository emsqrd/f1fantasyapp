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
    public DbSet<Race> Races => Set<Race>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<SeasonConstructor> SeasonConstructors => Set<SeasonConstructor>();
    public DbSet<SeasonDriver> SeasonDrivers => Set<SeasonDriver>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<TeamDriver> TeamDrivers => Set<TeamDriver>();
    public DbSet<TeamConstructor> TeamConstructors => Set<TeamConstructor>();
    public DbSet<LineupEntry> LineupEntries => Set<LineupEntry>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<DriverQualifyingResult> DriverQualifyingResults => Set<DriverQualifyingResult>();
    public DbSet<DriverRaceResult> DriverRaceResults => Set<DriverRaceResult>();
    public DbSet<TeamRaceScore> TeamRaceScores => Set<TeamRaceScore>();
    public DbSet<DriverRaceScore> DriverRaceScores => Set<DriverRaceScore>();
    public DbSet<ConstructorRaceScore> ConstructorRaceScores => Set<ConstructorRaceScore>();

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

        modelBuilder.Entity<Race>(entity =>
        {
            entity
                .HasOne(e => e.Season)
                .WithMany(s => s.Races)
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
                .HasOne(dqr => dqr.Race)
                .WithMany()
                .HasForeignKey(dqr => dqr.RaceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriverRaceResult>(entity =>
        {
            entity
                .HasOne(drr => drr.Driver)
                .WithMany()
                .HasForeignKey(drr => drr.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(drr => drr.Race)
                .WithMany()
                .HasForeignKey(drr => drr.RaceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TeamRaceScore>(entity =>
        {
            entity
                .HasOne(trs => trs.Team)
                .WithMany()
                .HasForeignKey(trs => trs.TeamId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(trs => trs.Race)
                .WithMany()
                .HasForeignKey(trs => trs.RaceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<DriverRaceScore>(entity =>
        {
            entity
                .HasOne(drs => drs.Driver)
                .WithMany()
                .HasForeignKey(drs => drs.DriverId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(drs => drs.Race)
                .WithMany()
                .HasForeignKey(drs => drs.RaceId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ConstructorRaceScore>(entity =>
        {
            entity
                .HasOne(crs => crs.Constructor)
                .WithMany()
                .HasForeignKey(crs => crs.ConstructorId)
                .OnDelete(DeleteBehavior.Restrict);

            entity
                .HasOne(crs => crs.Race)
                .WithMany()
                .HasForeignKey(crs => crs.RaceId)
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
                .HasOne(le => le.Race)
                .WithMany()
                .HasForeignKey(le => le.RaceId)
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
