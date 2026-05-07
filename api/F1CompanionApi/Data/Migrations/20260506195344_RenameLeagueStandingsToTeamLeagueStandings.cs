using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameLeagueStandingsToTeamLeagueStandings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FKs on LeagueStandings
            migrationBuilder.DropForeignKey(
                name: "FK_LeagueStandings_Leagues_LeagueId",
                table: "LeagueStandings");

            migrationBuilder.DropForeignKey(
                name: "FK_LeagueStandings_RaceWeekends_RaceWeekendId",
                table: "LeagueStandings");

            migrationBuilder.DropForeignKey(
                name: "FK_LeagueStandings_Teams_TeamId",
                table: "LeagueStandings");

            // Rename table
            migrationBuilder.RenameTable(
                name: "LeagueStandings",
                newName: "TeamLeagueStandings");

            // Rename PK constraint
            migrationBuilder.Sql(
                "ALTER TABLE \"TeamLeagueStandings\" RENAME CONSTRAINT \"PK_LeagueStandings\" TO \"PK_TeamLeagueStandings\";"
            );

            // Rename indexes
            migrationBuilder.RenameIndex(
                name: "IX_LeagueStandings_LeagueId_RaceWeekendId_Position",
                table: "TeamLeagueStandings",
                newName: "IX_TeamLeagueStandings_LeagueId_RaceWeekendId_Position");

            migrationBuilder.RenameIndex(
                name: "IX_LeagueStandings_LeagueId_TeamId_RaceWeekendId",
                table: "TeamLeagueStandings",
                newName: "IX_TeamLeagueStandings_LeagueId_TeamId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_LeagueStandings_RaceWeekendId",
                table: "TeamLeagueStandings",
                newName: "IX_TeamLeagueStandings_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_LeagueStandings_TeamId",
                table: "TeamLeagueStandings",
                newName: "IX_TeamLeagueStandings_TeamId");

            // Re-add FKs with new names
            migrationBuilder.AddForeignKey(
                name: "FK_TeamLeagueStandings_Leagues_LeagueId",
                table: "TeamLeagueStandings",
                column: "LeagueId",
                principalTable: "Leagues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamLeagueStandings_RaceWeekends_RaceWeekendId",
                table: "TeamLeagueStandings",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamLeagueStandings_Teams_TeamId",
                table: "TeamLeagueStandings",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TeamLeagueStandings_Leagues_LeagueId",
                table: "TeamLeagueStandings");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamLeagueStandings_RaceWeekends_RaceWeekendId",
                table: "TeamLeagueStandings");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamLeagueStandings_Teams_TeamId",
                table: "TeamLeagueStandings");

            migrationBuilder.RenameIndex(
                name: "IX_TeamLeagueStandings_LeagueId_RaceWeekendId_Position",
                table: "TeamLeagueStandings",
                newName: "IX_LeagueStandings_LeagueId_RaceWeekendId_Position");

            migrationBuilder.RenameIndex(
                name: "IX_TeamLeagueStandings_LeagueId_TeamId_RaceWeekendId",
                table: "TeamLeagueStandings",
                newName: "IX_LeagueStandings_LeagueId_TeamId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamLeagueStandings_RaceWeekendId",
                table: "TeamLeagueStandings",
                newName: "IX_LeagueStandings_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamLeagueStandings_TeamId",
                table: "TeamLeagueStandings",
                newName: "IX_LeagueStandings_TeamId");

            migrationBuilder.Sql(
                "ALTER TABLE \"TeamLeagueStandings\" RENAME CONSTRAINT \"PK_TeamLeagueStandings\" TO \"PK_LeagueStandings\";"
            );

            migrationBuilder.RenameTable(
                name: "TeamLeagueStandings",
                newName: "LeagueStandings");

            migrationBuilder.AddForeignKey(
                name: "FK_LeagueStandings_Leagues_LeagueId",
                table: "LeagueStandings",
                column: "LeagueId",
                principalTable: "Leagues",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_LeagueStandings_RaceWeekends_RaceWeekendId",
                table: "LeagueStandings",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LeagueStandings_Teams_TeamId",
                table: "LeagueStandings",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
