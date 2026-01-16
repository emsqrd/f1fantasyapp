using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class FixMaxTeamsToBoolean : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // First, add a temporary boolean column
            migrationBuilder.AddColumn<bool>(
                name: "MaxTeams_temp",
                table: "Leagues",
                type: "boolean",
                nullable: false,
                defaultValue: false
            );

            // Convert the existing string data to boolean
            migrationBuilder.Sql(
                @"
                UPDATE ""Leagues"" 
                SET ""MaxTeams_temp"" = CASE 
                    WHEN LOWER(""MaxTeams"") IN ('true', 't', 'yes', 'y', '1') THEN true
                    ELSE false 
                END;
            "
            );

            // Drop the old string column
            migrationBuilder.DropColumn(name: "MaxTeams", table: "Leagues");

            // Rename the temp column to the original name
            migrationBuilder.RenameColumn(
                name: "MaxTeams_temp",
                table: "Leagues",
                newName: "MaxTeams"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Add a temporary string column
            migrationBuilder.AddColumn<string>(
                name: "MaxTeams_temp",
                table: "Leagues",
                type: "text",
                nullable: false,
                defaultValue: "false"
            );

            // Convert boolean back to string
            migrationBuilder.Sql(
                @"
                UPDATE ""Leagues"" 
                SET ""MaxTeams_temp"" = CASE 
                    WHEN ""MaxTeams"" = true THEN 'true'
                    ELSE 'false'
                END;
            "
            );

            // Drop the boolean column
            migrationBuilder.DropColumn(name: "MaxTeams", table: "Leagues");

            // Rename temp column back
            migrationBuilder.RenameColumn(
                name: "MaxTeams_temp",
                table: "Leagues",
                newName: "MaxTeams"
            );
        }
    }
}
