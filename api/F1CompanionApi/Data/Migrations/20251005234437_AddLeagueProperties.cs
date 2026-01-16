using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLeagueProperties : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "UserProfiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "UserProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "UserProfiles",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Teams",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Teams",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Teams",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Teams",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Leagues",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Leagues",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Leagues",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Leagues",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Leagues",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Leagues",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Leagues",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "Drivers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Drivers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Drivers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Drivers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Drivers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "Drivers",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Drivers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Accounts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "Accounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Leagues");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "UpdatedAt",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Accounts");
        }
    }
}
