using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RenameRaceToSeasonRace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_Races_RaceId",
                table: "ConstructorRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverQualifyingResults_Races_RaceId",
                table: "DriverQualifyingResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceResults_Races_RaceId",
                table: "DriverRaceResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_Races_RaceId",
                table: "DriverRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_LineupEntries_Races_RaceId",
                table: "LineupEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_Races_RaceId",
                table: "TeamRaceScores");

            migrationBuilder.DropTable(
                name: "Races");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "TeamRaceScores",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_TeamId_RaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_TeamId_SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_RaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_SeasonRaceId");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "LineupEntries",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_TeamId_RaceId_EntityType_SlotPosition",
                table: "LineupEntries",
                newName: "IX_LineupEntries_TeamId_SeasonRaceId_EntityType_SlotPosition");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_RaceId",
                table: "LineupEntries",
                newName: "IX_LineupEntries_SeasonRaceId");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverRaceScores",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_RaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_DriverId_RaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_DriverId_SeasonRaceId");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverRaceResults",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_RaceId",
                table: "DriverRaceResults",
                newName: "IX_DriverRaceResults_SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_DriverId_RaceId_SessionType",
                table: "DriverRaceResults",
                newName: "IX_DriverRaceResults_DriverId_SeasonRaceId_SessionType");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "DriverQualifyingResults",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_RaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_DriverId_RaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_DriverId_SeasonRaceId");

            migrationBuilder.RenameColumn(
                name: "RaceId",
                table: "ConstructorRaceScores",
                newName: "SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_RaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_SeasonRaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_RaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_ConstructorId_SeasonRaceId");

            migrationBuilder.CreateTable(
                name: "SeasonRaces",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    CircuitId = table.Column<int>(type: "integer", nullable: false),
                    RaceDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LockDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HasSprint = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeasonRaces", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeasonRaces_Circuits_CircuitId",
                        column: x => x.CircuitId,
                        principalTable: "Circuits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeasonRaces_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRaces_CircuitId",
                table: "SeasonRaces",
                column: "CircuitId");

            migrationBuilder.CreateIndex(
                name: "IX_SeasonRaces_SeasonId_Round",
                table: "SeasonRaces",
                columns: new[] { "SeasonId", "Round" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ConstructorRaceScores_SeasonRaces_SeasonRaceId",
                table: "ConstructorRaceScores",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverQualifyingResults_SeasonRaces_SeasonRaceId",
                table: "DriverQualifyingResults",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceResults_SeasonRaces_SeasonRaceId",
                table: "DriverRaceResults",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_DriverRaceScores_SeasonRaces_SeasonRaceId",
                table: "DriverRaceScores",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LineupEntries_SeasonRaces_SeasonRaceId",
                table: "LineupEntries",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TeamRaceScores_SeasonRaces_SeasonRaceId",
                table: "TeamRaceScores",
                column: "SeasonRaceId",
                principalTable: "SeasonRaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ConstructorRaceScores_SeasonRaces_SeasonRaceId",
                table: "ConstructorRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverQualifyingResults_SeasonRaces_SeasonRaceId",
                table: "DriverQualifyingResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceResults_SeasonRaces_SeasonRaceId",
                table: "DriverRaceResults");

            migrationBuilder.DropForeignKey(
                name: "FK_DriverRaceScores_SeasonRaces_SeasonRaceId",
                table: "DriverRaceScores");

            migrationBuilder.DropForeignKey(
                name: "FK_LineupEntries_SeasonRaces_SeasonRaceId",
                table: "LineupEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_TeamRaceScores_SeasonRaces_SeasonRaceId",
                table: "TeamRaceScores");

            migrationBuilder.DropTable(
                name: "SeasonRaces");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "TeamRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_TeamId_SeasonRaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_TeamId_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_TeamRaceScores_SeasonRaceId",
                table: "TeamRaceScores",
                newName: "IX_TeamRaceScores_RaceId");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "LineupEntries",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_TeamId_SeasonRaceId_EntityType_SlotPosition",
                table: "LineupEntries",
                newName: "IX_LineupEntries_TeamId_RaceId_EntityType_SlotPosition");

            migrationBuilder.RenameIndex(
                name: "IX_LineupEntries_SeasonRaceId",
                table: "LineupEntries",
                newName: "IX_LineupEntries_RaceId");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "DriverRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_SeasonRaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceScores_DriverId_SeasonRaceId",
                table: "DriverRaceScores",
                newName: "IX_DriverRaceScores_DriverId_RaceId");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "DriverRaceResults",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_SeasonRaceId",
                table: "DriverRaceResults",
                newName: "IX_DriverRaceResults_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverRaceResults_DriverId_SeasonRaceId_SessionType",
                table: "DriverRaceResults",
                newName: "IX_DriverRaceResults_DriverId_RaceId_SessionType");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "DriverQualifyingResults",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_SeasonRaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_DriverQualifyingResults_DriverId_SeasonRaceId",
                table: "DriverQualifyingResults",
                newName: "IX_DriverQualifyingResults_DriverId_RaceId");

            migrationBuilder.RenameColumn(
                name: "SeasonRaceId",
                table: "ConstructorRaceScores",
                newName: "RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_SeasonRaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_RaceId");

            migrationBuilder.RenameIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_SeasonRaceId",
                table: "ConstructorRaceScores",
                newName: "IX_ConstructorRaceScores_ConstructorId_RaceId");

            migrationBuilder.CreateTable(
                name: "Races",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CircuitId = table.Column<int>(type: "integer", nullable: false),
                    SeasonId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    HasSprint = table.Column<bool>(type: "boolean", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    LockDeadline = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Name = table.Column<string>(type: "text", nullable: false),
                    RaceDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Round = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Races", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Races_Circuits_CircuitId",
                        column: x => x.CircuitId,
                        principalTable: "Circuits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Races_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Races_CircuitId",
                table: "Races",
                column: "CircuitId");

            migrationBuilder.CreateIndex(
                name: "IX_Races_SeasonId_Round",
                table: "Races",
                columns: new[] { "SeasonId", "Round" },
                unique: true);

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
                name: "FK_DriverRaceResults_Races_RaceId",
                table: "DriverRaceResults",
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
