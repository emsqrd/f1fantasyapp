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
                name: "IX_Circuits_Name",
                table: "Circuits",
                column: "Name",
                unique: true);

            // Add CircuitId as nullable temporarily so existing rows can be backfilled
            migrationBuilder.AddColumn<int>(
                name: "CircuitId",
                table: "Races",
                type: "integer",
                nullable: true);

            // Backfill Circuits from existing Race data
            migrationBuilder.Sql(@"
                INSERT INTO ""Circuits"" (""Name"", ""Location"", ""Country"", ""CreatedAt"", ""UpdatedAt"", ""DeletedAt"", ""IsDeleted"")
                SELECT DISTINCT ""Circuit"", ""Location"", ""Country"", NOW(), NOW(), NULL::timestamptz, FALSE
                FROM ""Races""
                WHERE NOT EXISTS (
                    SELECT 1 FROM ""Circuits"" WHERE ""Circuits"".""Name"" = ""Races"".""Circuit""
                )
                ORDER BY ""Circuit"";
            ");

            // Set CircuitId on each Race from the backfilled Circuits table
            migrationBuilder.Sql(@"
                UPDATE ""Races""
                SET ""CircuitId"" = ""Circuits"".""Id""
                FROM ""Circuits""
                WHERE ""Races"".""Circuit"" = ""Circuits"".""Name"";
            ");

            // Now make CircuitId non-nullable
            migrationBuilder.AlterColumn<int>(
                name: "CircuitId",
                table: "Races",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

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

            migrationBuilder.DropColumn(
                name: "Circuit",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "Races");

            migrationBuilder.DropColumn(
                name: "Location",
                table: "Races");
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
