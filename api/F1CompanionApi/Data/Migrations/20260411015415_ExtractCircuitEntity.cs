using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class ExtractCircuitEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // CircuitId is non-nullable; existing rows cannot satisfy the FK constraint.
            // CASCADE clears all FK-dependent tables (LineupEntries, RaceScores, etc.).
            // Re-run seed.sql after this migration to repopulate Circuits and Races.
            migrationBuilder.Sql("TRUNCATE \"Races\" CASCADE;");

            migrationBuilder.DropColumn(
                name: "Circuit",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Races");

            migrationBuilder.AddColumn<int>(
                name: "CircuitId",
                table: "Races",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "Circuits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: false),
                    Country = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Circuits", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Races_CircuitId",
                table: "Races",
                column: "CircuitId");

            migrationBuilder.AddForeignKey(
                name: "FK_Races_Circuits_CircuitId",
                table: "Races",
                column: "CircuitId",
                principalTable: "Circuits",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Races_Circuits_CircuitId",
                table: "Races");

            migrationBuilder.DropTable(
                name: "Circuits");

            migrationBuilder.DropIndex(
                name: "IX_Races_CircuitId",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "CircuitId",
                table: "Races");

            migrationBuilder.AddColumn<string>(
                name: "Circuit",
                table: "Races",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "Races",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Location",
                table: "Races",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
