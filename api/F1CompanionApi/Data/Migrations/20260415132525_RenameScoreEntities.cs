using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameScoreEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FKs on ConstructorRaceScores
            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_Constructors_ConstructorId",
                table: "ConstructorRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceScores");

            // Drop FKs on DriverRaceScores
            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_Drivers_DriverId",
                table: "DriverRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceScores");

            // Drop FKs on TeamRaceScores
            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_Teams_TeamId",
                table: "TeamRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_RaceWeekends_RaceWeekendId",
                table: "TeamRaceScores");

            // Rename tables
            migrationBuilder.RenameTable(
                name: "ConstructorRaceScores",
                newName: "ConstructorRaceWeekendScores");

            migrationBuilder.RenameTable(
                name: "DriverRaceScores",
                newName: "DriverRaceWeekendScores");

            migrationBuilder.RenameTable(
                name: "TeamRaceScores",
                newName: "TeamRaceWeekendScores");

            // Rename PK constraints
            migrationBuilder.Sql(
                "ALTER TABLE \"ConstructorRaceWeekendScores\" RENAME CONSTRAINT \"PK_ConstructorRaceScores\" TO \"PK_ConstructorRaceWeekendScores\";"
            );
            migrationBuilder.Sql(
                "ALTER TABLE \"DriverRaceWeekendScores\" RENAME CONSTRAINT \"PK_DriverRaceScores\" TO \"PK_DriverRaceWeekendScores\";"
            );
            migrationBuilder.Sql(
                "ALTER TABLE \"TeamRaceWeekendScores\" RENAME CONSTRAINT \"PK_TeamRaceScores\" TO \"PK_TeamRaceWeekendScores\";"
            );

            // Rename Race* columns to GrandPrix* on ConstructorRaceWeekendScores
            migrationBuilder.RenameColumn(
                name: "RacePositionPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixPositionPoints");

            migrationBuilder.RenameColumn(
                name: "RacePositionChangePoints",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixPositionChangePoints");

            migrationBuilder.RenameColumn(
                name: "RaceOvertakePoints",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixOvertakePoints");

            migrationBuilder.RenameColumn(
                name: "RaceFastestLapPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixFastestLapPoints");

            migrationBuilder.RenameColumn(
                name: "RacePenaltyPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixPenaltyPoints");

            migrationBuilder.RenameColumn(
                name: "RaceTotal",
                table: "ConstructorRaceWeekendScores",
                newName: "GrandPrixTotal");

            // Rename Race* columns to GrandPrix* on DriverRaceWeekendScores
            migrationBuilder.RenameColumn(
                name: "RacePositionPoints",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixPositionPoints");

            migrationBuilder.RenameColumn(
                name: "RacePositionChangePoints",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixPositionChangePoints");

            migrationBuilder.RenameColumn(
                name: "RaceOvertakePoints",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixOvertakePoints");

            migrationBuilder.RenameColumn(
                name: "RaceFastestLapPoints",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixFastestLapPoints");

            migrationBuilder.RenameColumn(
                name: "RacePenaltyPoints",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixPenaltyPoints");

            migrationBuilder.RenameColumn(
                name: "RaceTotal",
                table: "DriverRaceWeekendScores",
                newName: "GrandPrixTotal");

            // Rename indexes on ConstructorRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_RaceWeekendId",
                table: "ConstructorRaceWeekendScores",
                newName: "IX_ConstructorRaceWeekendScores_ConstructorId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_RaceWeekendId",
                table: "ConstructorRaceWeekendScores",
                newName: "IX_ConstructorRaceWeekendScores_RaceWeekendId");

            // Rename indexes on DriverRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_DriverId_RaceWeekendId",
                table: "DriverRaceWeekendScores",
                newName: "IX_DriverRaceWeekendScores_DriverId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_RaceWeekendId",
                table: "DriverRaceWeekendScores",
                newName: "IX_DriverRaceWeekendScores_RaceWeekendId");

            // Rename indexes on TeamRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_TeamId_RaceWeekendId",
                table: "TeamRaceWeekendScores",
                newName: "IX_TeamRaceWeekendScores_TeamId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_RaceWeekendId",
                table: "TeamRaceWeekendScores",
                newName: "IX_TeamRaceWeekendScores_RaceWeekendId");

            // Re-add FKs with new names on ConstructorRaceWeekendScores
            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceWeekendScores_Constructors_ConstructorId",
                table: "ConstructorRaceWeekendScores",
                column: "ConstructorId",
                principalTable: "Constructors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceWeekendScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs with new names on DriverRaceWeekendScores
            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceWeekendScores_Drivers_DriverId",
                table: "DriverRaceWeekendScores",
                column: "DriverId",
                principalTable: "Drivers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceWeekendScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs with new names on TeamRaceWeekendScores
            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceWeekendScores_Teams_TeamId",
                table: "TeamRaceWeekendScores",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "TeamRaceWeekendScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop FKs on renamed tables
            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceWeekendScores_Constructors_ConstructorId",
                table: "ConstructorRaceWeekendScores");

            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceWeekendScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceWeekendScores_Drivers_DriverId",
                table: "DriverRaceWeekendScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceWeekendScores");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceWeekendScores_Teams_TeamId",
                table: "TeamRaceWeekendScores");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceWeekendScores_RaceWeekends_RaceWeekendId",
                table: "TeamRaceWeekendScores");

            // Rename indexes back on ConstructorRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceWeekendScores_ConstructorId_RaceWeekendId",
                table: "ConstructorRaceWeekendScores",
                newName: "IX_ConstructorRaceScores_ConstructorId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceWeekendScores_RaceWeekendId",
                table: "ConstructorRaceWeekendScores",
                newName: "IX_ConstructorRaceScores_RaceWeekendId");

            // Rename indexes back on DriverRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceWeekendScores_DriverId_RaceWeekendId",
                table: "DriverRaceWeekendScores",
                newName: "IX_DriverRaceScores_DriverId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceWeekendScores_RaceWeekendId",
                table: "DriverRaceWeekendScores",
                newName: "IX_DriverRaceScores_RaceWeekendId");

            // Rename indexes back on TeamRaceWeekendScores
            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceWeekendScores_TeamId_RaceWeekendId",
                table: "TeamRaceWeekendScores",
                newName: "IX_TeamRaceScores_TeamId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceWeekendScores_RaceWeekendId",
                table: "TeamRaceWeekendScores",
                newName: "IX_TeamRaceScores_RaceWeekendId");

            // Rename GrandPrix* columns back to Race* on ConstructorRaceWeekendScores
            migrationBuilder.RenameColumn(
                name: "GrandPrixPositionPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "RacePositionPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixPositionChangePoints",
                table: "ConstructorRaceWeekendScores",
                newName: "RacePositionChangePoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixOvertakePoints",
                table: "ConstructorRaceWeekendScores",
                newName: "RaceOvertakePoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixFastestLapPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "RaceFastestLapPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixPenaltyPoints",
                table: "ConstructorRaceWeekendScores",
                newName: "RacePenaltyPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixTotal",
                table: "ConstructorRaceWeekendScores",
                newName: "RaceTotal");

            // Rename GrandPrix* columns back to Race* on DriverRaceWeekendScores
            migrationBuilder.RenameColumn(
                name: "GrandPrixPositionPoints",
                table: "DriverRaceWeekendScores",
                newName: "RacePositionPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixPositionChangePoints",
                table: "DriverRaceWeekendScores",
                newName: "RacePositionChangePoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixOvertakePoints",
                table: "DriverRaceWeekendScores",
                newName: "RaceOvertakePoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixFastestLapPoints",
                table: "DriverRaceWeekendScores",
                newName: "RaceFastestLapPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixPenaltyPoints",
                table: "DriverRaceWeekendScores",
                newName: "RacePenaltyPoints");

            migrationBuilder.RenameColumn(
                name: "GrandPrixTotal",
                table: "DriverRaceWeekendScores",
                newName: "RaceTotal");

            // Rename PK constraints back
            migrationBuilder.Sql(
                "ALTER TABLE \"ConstructorRaceWeekendScores\" RENAME CONSTRAINT \"PK_ConstructorRaceWeekendScores\" TO \"PK_ConstructorRaceScores\";"
            );
            migrationBuilder.Sql(
                "ALTER TABLE \"DriverRaceWeekendScores\" RENAME CONSTRAINT \"PK_DriverRaceWeekendScores\" TO \"PK_DriverRaceScores\";"
            );
            migrationBuilder.Sql(
                "ALTER TABLE \"TeamRaceWeekendScores\" RENAME CONSTRAINT \"PK_TeamRaceWeekendScores\" TO \"PK_TeamRaceScores\";"
            );

            // Rename tables back
            migrationBuilder.RenameTable(
                name: "ConstructorRaceWeekendScores",
                newName: "ConstructorRaceScores");

            migrationBuilder.RenameTable(
                name: "DriverRaceWeekendScores",
                newName: "DriverRaceScores");

            migrationBuilder.RenameTable(
                name: "TeamRaceWeekendScores",
                newName: "TeamRaceScores");

            // Re-add FKs with old names on ConstructorRaceScores
            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceScores_Constructors_ConstructorId",
                table: "ConstructorRaceScores",
                column: "ConstructorId",
                principalTable: "Constructors",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs with old names on DriverRaceScores
            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceScores_Drivers_DriverId",
                table: "DriverRaceScores",
                column: "DriverId",
                principalTable: "Drivers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs with old names on TeamRaceScores
            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceScores_Teams_TeamId",
                table: "TeamRaceScores",
                column: "TeamId",
                principalTable: "Teams",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceScores_RaceWeekends_RaceWeekendId",
                table: "TeamRaceScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
