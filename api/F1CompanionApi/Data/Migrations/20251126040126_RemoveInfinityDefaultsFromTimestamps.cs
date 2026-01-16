using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveInfinityDefaultsFromTimestamps : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove -infinity defaults from Drivers table timestamp columns
            migrationBuilder.Sql(@"
                ALTER TABLE ""Drivers"" ALTER COLUMN ""CreatedAt"" DROP DEFAULT;
                ALTER TABLE ""Drivers"" ALTER COLUMN ""UpdatedAt"" DROP DEFAULT;
                ALTER TABLE ""Drivers"" ALTER COLUMN ""DeletedAt"" DROP DEFAULT;
            ");

            // Remove -infinity defaults from Constructors table timestamp columns
            migrationBuilder.Sql(@"
                ALTER TABLE ""Constructors"" ALTER COLUMN ""CreatedAt"" DROP DEFAULT;
                ALTER TABLE ""Constructors"" ALTER COLUMN ""UpdatedAt"" DROP DEFAULT;
                ALTER TABLE ""Constructors"" ALTER COLUMN ""DeletedAt"" DROP DEFAULT;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore -infinity defaults (if you ever need to roll back)
            migrationBuilder.Sql(@"
                ALTER TABLE ""Drivers"" ALTER COLUMN ""CreatedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
                ALTER TABLE ""Drivers"" ALTER COLUMN ""UpdatedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
                ALTER TABLE ""Drivers"" ALTER COLUMN ""DeletedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
            ");

            migrationBuilder.Sql(@"
                ALTER TABLE ""Constructors"" ALTER COLUMN ""CreatedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
                ALTER TABLE ""Constructors"" ALTER COLUMN ""UpdatedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
                ALTER TABLE ""Constructors"" ALTER COLUMN ""DeletedAt"" SET DEFAULT '-infinity'::timestamp with time zone;
            ");
        }
    }
}
