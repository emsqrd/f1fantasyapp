using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class UpdateLeagueMaxTeamsToBeIntFromBoolean : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // First, drop any existing default value
            migrationBuilder.Sql(
                @"ALTER TABLE ""Leagues"" 
          ALTER COLUMN ""MaxTeams"" DROP DEFAULT;"
            );

            // Then convert the column type with the USING clause
            migrationBuilder.Sql(
                @"ALTER TABLE ""Leagues"" 
          ALTER COLUMN ""MaxTeams"" TYPE integer 
          USING (CASE WHEN ""MaxTeams"" = true THEN 1 ELSE 0 END);"
            );

            // Optionally, set a new default value (e.g., 0 or whatever makes sense)
            migrationBuilder.Sql(
                @"ALTER TABLE ""Leagues"" 
          ALTER COLUMN ""MaxTeams"" SET DEFAULT 0;"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "MaxTeams",
                table: "Leagues",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer"
            );
        }
    }
}
