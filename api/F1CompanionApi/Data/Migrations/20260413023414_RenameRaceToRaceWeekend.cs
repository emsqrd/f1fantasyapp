using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameRaceToRaceWeekend : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FKs on dependent tables that reference Races
            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_Races_RaceId",
                table: "ConstructorRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverQualifyingResults_Races_RaceId",
                table: "DriverQualifyingResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_Races_RaceId",
                table: "DriverRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_LineupEntries_Races_RaceId",
                table: "LineupEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_Races_RaceId",
                table: "TeamRaceScores");

            // Drop FK on DriverRaceResults that references Races
            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceResults_Races_RaceId",
                table: "DriverRaceResults");

            // Rename tables
            migrationBuilder.RenameTable(
                name: "Races",
                newName: "RaceWeekends");

            migrationBuilder.RenameTable(
                name: "DriverRaceResults",
                newName: "DriverRacingResults");

            // Rename PK and DriverId FK constraints on renamed tables so future migrations use correct names
            migrationBuilder.Sql("ALTER TABLE \"RaceWeekends\" RENAME CONSTRAINT \"PK_Races\" TO \"PK_RaceWeekends\";");
            migrationBuilder.Sql("ALTER TABLE \"DriverRacingResults\" RENAME CONSTRAINT \"PK_DriverRaceResults\" TO \"PK_DriverRacingResults\";");
            migrationBuilder.Sql("ALTER TABLE \"DriverRacingResults\" RENAME CONSTRAINT \"FK_DriverRaceResults_Drivers_DriverId\" TO \"FK_DriverRacingResults_Drivers_DriverId\";");

            // Rename RaceId → RaceWeekendId in DriverRacingResults
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverRacingResults",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_RaceId",
                table: "DriverRacingResults",
                newName: "IX_DriverRacingResults_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_DriverId_RaceId_SessionType",
                table: "DriverRacingResults",
                newName: "IX_DriverRacingResults_DriverId_RaceWeekendId_SessionType");

            // Rename RaceId → RaceWeekendId in TeamRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "TeamRaceScores",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_TeamId_RaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_TeamId_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_RaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_RaceWeekendId");

            // Rename RaceId → RaceWeekendId in LineupEntries
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "LineupEntries",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_TeamId_RaceId_EntityType_SlotPosition",
                table: "LineupEntries",
                newName: "IX_LineupEntries_TeamId_RaceWeekendId_EntityType_SlotPosition");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_RaceId",
                table: "LineupEntries",
                newName: "IX_LineupEntries_RaceWeekendId");

            // Rename RaceId → RaceWeekendId in DriverRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverRaceScores",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_RaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_DriverId_RaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_DriverId_RaceWeekendId");

            // Rename RaceId → RaceWeekendId in DriverQualifyingResults
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverQualifyingResults",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_RaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_DriverId_RaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_DriverId_RaceWeekendId");

            // Rename RaceId → RaceWeekendId in ConstructorRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "ConstructorRaceScores",
                newName: "RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_RaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_RaceWeekendId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_RaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_ConstructorId_RaceWeekendId");

            // Rename indexes on RaceWeekends (old Races)
            migrationBuilder.RenameIndex(
                name: "IX_Races_SeasonId_Round",
                table: "RaceWeekends",
                newName: "IX_RaceWeekends_SeasonId_Round");

            migrationBuilder.RenameIndex(
                name: "IX_Races_CircuitId",
                table: "RaceWeekends",
                newName: "IX_RaceWeekends_CircuitId");

            // Re-add FK on DriverRacingResults pointing to RaceWeekends
            migrationBuilder.AddForeignKey(
                name: "FK_DriverRacingResults_RaceWeekends_RaceWeekendId",
                table: "DriverRacingResults",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs on dependent tables pointing to RaceWeekends
            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverQualifyingResults_RaceWeekends_RaceWeekendId",
                table: "DriverQualifyingResults",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceScores",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LineupEntries_RaceWeekends_RaceWeekendId",
                table: "LineupEntries",
                column: "RaceWeekendId",
                principalTable: "RaceWeekends",
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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop FKs pointing to RaceWeekends
            migrationBuilder.DropForeignKey(
                name: "FK_DriverRacingResults_RaceWeekends_RaceWeekendId",
                table: "DriverRacingResults");

            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_RaceWeekends_RaceWeekendId",
                table: "ConstructorRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverQualifyingResults_RaceWeekends_RaceWeekendId",
                table: "DriverQualifyingResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_RaceWeekends_RaceWeekendId",
                table: "DriverRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_LineupEntries_RaceWeekends_RaceWeekendId",
                table: "LineupEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_RaceWeekends_RaceWeekendId",
                table: "TeamRaceScores");

            // Rename indexes on RaceWeekends back to Races
            migrationBuilder.RenameIndex(
                name: "IX_RaceWeekends_SeasonId_Round",
                table: "RaceWeekends",
                newName: "IX_Races_SeasonId_Round");

            migrationBuilder.RenameIndex(
                name: "IX_RaceWeekends_CircuitId",
                table: "RaceWeekends",
                newName: "IX_Races_CircuitId");

            // Rename RaceWeekendId → RaceId in ConstructorRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "ConstructorRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_RaceWeekendId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_RaceWeekendId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_ConstructorId_RaceId");

            // Rename RaceWeekendId → RaceId in DriverQualifyingResults
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "DriverQualifyingResults",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_RaceWeekendId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_DriverId_RaceWeekendId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_DriverId_RaceId");

            // Rename RaceWeekendId → RaceId in DriverRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "DriverRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_RaceWeekendId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_DriverId_RaceWeekendId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_DriverId_RaceId");

            // Rename RaceWeekendId → RaceId in LineupEntries
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "LineupEntries",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_TeamId_RaceWeekendId_EntityType_SlotPosition",
                table: "LineupEntries",
                newName: "IX_LineupEntries_TeamId_RaceId_EntityType_SlotPosition");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_RaceWeekendId",
                table: "LineupEntries",
                newName: "IX_LineupEntries_RaceId");

            // Rename RaceWeekendId → RaceId in TeamRaceScores
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "TeamRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_TeamId_RaceWeekendId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_TeamId_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_RaceWeekendId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_RaceId");

            // Rename RaceWeekendId → RaceId in DriverRacingResults
            migrationBuilder.RenameColumn(
                name: "RaceWeekendId",
                table: "DriverRacingResults",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRacingResults_RaceWeekendId",
                table: "DriverRacingResults",
                newName: "IX_DriverRaceResults_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRacingResults_DriverId_RaceWeekendId_SessionType",
                table: "DriverRacingResults",
                newName: "IX_DriverRaceResults_DriverId_RaceId_SessionType");

            // Restore constraint names
            migrationBuilder.Sql("ALTER TABLE \"DriverRacingResults\" RENAME CONSTRAINT \"FK_DriverRacingResults_Drivers_DriverId\" TO \"FK_DriverRaceResults_Drivers_DriverId\";");
            migrationBuilder.Sql("ALTER TABLE \"DriverRacingResults\" RENAME CONSTRAINT \"PK_DriverRacingResults\" TO \"PK_DriverRaceResults\";");
            migrationBuilder.Sql("ALTER TABLE \"RaceWeekends\" RENAME CONSTRAINT \"PK_RaceWeekends\" TO \"PK_Races\";");

            // Rename tables back
            migrationBuilder.RenameTable(
                name: "DriverRacingResults",
                newName: "DriverRaceResults");

            migrationBuilder.RenameTable(
                name: "RaceWeekends",
                newName: "Races");

            // Re-add FK on DriverRaceResults pointing to Races
            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceResults_Races_RaceId",
                table: "DriverRaceResults",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Re-add FKs on dependent tables pointing to Races
            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceScores_Races_RaceId",
                table: "ConstructorRaceScores",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverQualifyingResults_Races_RaceId",
                table: "DriverQualifyingResults",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceScores_Races_RaceId",
                table: "DriverRaceScores",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LineupEntries_Races_RaceId",
                table: "LineupEntries",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceScores_Races_RaceId",
                table: "TeamRaceScores",
                column: "RaceId",
                principalTable: "Races",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
