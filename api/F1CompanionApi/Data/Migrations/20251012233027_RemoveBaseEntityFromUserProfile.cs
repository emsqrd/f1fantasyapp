using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveBaseEntityFromUserProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserProfiles_UserProfiles_CreatedBy",
                table: "UserProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProfiles_UserProfiles_DeletedBy",
                table: "UserProfiles");

            migrationBuilder.DropForeignKey(
                name: "FK_UserProfiles_UserProfiles_UpdatedBy",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_CreatedBy",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_DeletedBy",
                table: "UserProfiles");

            migrationBuilder.DropIndex(
                name: "IX_UserProfiles_UpdatedBy",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "UserProfiles");

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
                name: "UpdatedAt",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "UserProfiles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "UserProfiles",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

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
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "UserProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "UserProfiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpdatedAt",
                table: "UserProfiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "UserProfiles",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_CreatedBy",
                table: "UserProfiles",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_DeletedBy",
                table: "UserProfiles",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_UpdatedBy",
                table: "UserProfiles",
                column: "UpdatedBy");

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfiles_UserProfiles_CreatedBy",
                table: "UserProfiles",
                column: "CreatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfiles_UserProfiles_DeletedBy",
                table: "UserProfiles",
                column: "DeletedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_UserProfiles_UserProfiles_UpdatedBy",
                table: "UserProfiles",
                column: "UpdatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
