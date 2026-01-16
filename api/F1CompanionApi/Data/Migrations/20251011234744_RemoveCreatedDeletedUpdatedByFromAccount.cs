using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveCreatedDeletedUpdatedByFromAccount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Accounts");

            migrationBuilder.AlterColumn<DateTime>(
                name: "DeletedAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "DeletedAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
