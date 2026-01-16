using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverAndConstructor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Number",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "Points",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "Price",
                table: "Drivers");

            migrationBuilder.AlterColumn<string>(
                name: "CountryAbbreviation",
                table: "Drivers",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Abbreviation",
                table: "Drivers",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Drivers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "Constructors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false),
                    FullName = table.Column<string>(type: "text", nullable: true),
                    CountryAbbreviation = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Constructors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Constructors_UserProfiles_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Constructors_UserProfiles_DeletedBy",
                        column: x => x.DeletedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Constructors_UserProfiles_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Constructors_CreatedBy",
                table: "Constructors",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Constructors_DeletedBy",
                table: "Constructors",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Constructors_UpdatedBy",
                table: "Constructors",
                column: "UpdatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Constructors");

            migrationBuilder.DropColumn(
                name: "Abbreviation",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Drivers");

            migrationBuilder.AlterColumn<string>(
                name: "CountryAbbreviation",
                table: "Drivers",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<int>(
                name: "Number",
                table: "Drivers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Points",
                table: "Drivers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "Drivers",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
