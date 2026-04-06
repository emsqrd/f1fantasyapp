using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEntityRaceScores : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConstructorRaceScores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ConstructorId = table.Column<int>(type: "integer", nullable: false),
                    RaceId = table.Column<int>(type: "integer", nullable: false),
                    QualifyingPositionPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPositionPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPositionChangePoints = table.Column<int>(type: "integer", nullable: true),
                    SprintOvertakePoints = table.Column<int>(type: "integer", nullable: true),
                    SprintFastestLapPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPenaltyPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintTotal = table.Column<int>(type: "integer", nullable: true),
                    RacePositionPoints = table.Column<int>(type: "integer", nullable: true),
                    RacePositionChangePoints = table.Column<int>(type: "integer", nullable: true),
                    RaceOvertakePoints = table.Column<int>(type: "integer", nullable: true),
                    RaceFastestLapPoints = table.Column<int>(type: "integer", nullable: true),
                    RacePenaltyPoints = table.Column<int>(type: "integer", nullable: true),
                    RaceTotal = table.Column<int>(type: "integer", nullable: true),
                    TotalPoints = table.Column<int>(type: "integer", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConstructorRaceScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConstructorRaceScores_Constructors_ConstructorId",
                        column: x => x.ConstructorId,
                        principalTable: "Constructors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConstructorRaceScores_Races_RaceId",
                        column: x => x.RaceId,
                        principalTable: "Races",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DriverRaceScores",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DriverId = table.Column<int>(type: "integer", nullable: false),
                    RaceId = table.Column<int>(type: "integer", nullable: false),
                    QualifyingPositionPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPositionPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPositionChangePoints = table.Column<int>(type: "integer", nullable: true),
                    SprintOvertakePoints = table.Column<int>(type: "integer", nullable: true),
                    SprintFastestLapPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintPenaltyPoints = table.Column<int>(type: "integer", nullable: true),
                    SprintTotal = table.Column<int>(type: "integer", nullable: true),
                    RacePositionPoints = table.Column<int>(type: "integer", nullable: true),
                    RacePositionChangePoints = table.Column<int>(type: "integer", nullable: true),
                    RaceOvertakePoints = table.Column<int>(type: "integer", nullable: true),
                    RaceFastestLapPoints = table.Column<int>(type: "integer", nullable: true),
                    RacePenaltyPoints = table.Column<int>(type: "integer", nullable: true),
                    RaceTotal = table.Column<int>(type: "integer", nullable: true),
                    TotalPoints = table.Column<int>(type: "integer", nullable: false),
                    CalculatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriverRaceScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DriverRaceScores_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DriverRaceScores_Races_RaceId",
                        column: x => x.RaceId,
                        principalTable: "Races",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConstructorRaceScores_ConstructorId_RaceId",
                table: "ConstructorRaceScores",
                columns: new[] { "ConstructorId", "RaceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConstructorRaceScores_RaceId",
                table: "ConstructorRaceScores",
                column: "RaceId");

            migrationBuilder.CreateIndex(
                name: "IX_DriverRaceScores_DriverId_RaceId",
                table: "DriverRaceScores",
                columns: new[] { "DriverId", "RaceId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DriverRaceScores_RaceId",
                table: "DriverRaceScores",
                column: "RaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConstructorRaceScores");

            migrationBuilder.DropTable(
                name: "DriverRaceScores");
        }
    }
}
