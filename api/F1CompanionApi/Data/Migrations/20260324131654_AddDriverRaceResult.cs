using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverRaceResult : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DriverRaceResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    DriverId = table.Column<int>(type: "integer", nullable: false),
                    RaceId = table.Column<int>(type: "integer", nullable: false),
                    SessionType = table.Column<int>(type: "integer", nullable: false),
                    GridPosition = table.Column<int>(type: "integer", nullable: false),
                    FinishPosition = table.Column<int>(type: "integer", nullable: true),
                    Overtakes = table.Column<int>(type: "integer", nullable: false),
                    FastestLap = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DriverRaceResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DriverRaceResults_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_DriverRaceResults_Races_RaceId",
                        column: x => x.RaceId,
                        principalTable: "Races",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DriverRaceResults_DriverId_RaceId_SessionType",
                table: "DriverRaceResults",
                columns: new[] { "DriverId", "RaceId", "SessionType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DriverRaceResults_RaceId",
                table: "DriverRaceResults",
                column: "RaceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DriverRaceResults");
        }
    }
}
