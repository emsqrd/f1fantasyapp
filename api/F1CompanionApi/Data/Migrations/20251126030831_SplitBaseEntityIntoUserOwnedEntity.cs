using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class SplitBaseEntityIntoUserOwnedEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Constructors_UserProfiles_CreatedBy",
                table: "Constructors");

            migrationBuilder.DropForeignKey(
                name: "FK_Constructors_UserProfiles_DeletedBy",
                table: "Constructors");

            migrationBuilder.DropForeignKey(
                name: "FK_Constructors_UserProfiles_UpdatedBy",
                table: "Constructors");

            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_CreatedBy",
                table: "Drivers");

            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_DeletedBy",
                table: "Drivers");

            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_UpdatedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_CreatedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_DeletedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_UpdatedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Constructors_CreatedBy",
                table: "Constructors");

            migrationBuilder.DropIndex(
                name: "IX_Constructors_DeletedBy",
                table: "Constructors");

            migrationBuilder.DropIndex(
                name: "IX_Constructors_UpdatedBy",
                table: "Constructors");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "Constructors");

            migrationBuilder.DropColumn(
                name: "DeletedBy",
                table: "Constructors");

            migrationBuilder.DropColumn(
                name: "UpdatedBy",
                table: "Constructors");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Drivers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Drivers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Drivers",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedBy",
                table: "Constructors",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "DeletedBy",
                table: "Constructors",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "UpdatedBy",
                table: "Constructors",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Drivers_CreatedBy",
                table: "Drivers",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Drivers_DeletedBy",
                table: "Drivers",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Drivers_UpdatedBy",
                table: "Drivers",
                column: "UpdatedBy");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Constructors_UserProfiles_CreatedBy",
                table: "Constructors",
                column: "CreatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Constructors_UserProfiles_DeletedBy",
                table: "Constructors",
                column: "DeletedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Constructors_UserProfiles_UpdatedBy",
                table: "Constructors",
                column: "UpdatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Drivers_UserProfiles_CreatedBy",
                table: "Drivers",
                column: "CreatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Drivers_UserProfiles_DeletedBy",
                table: "Drivers",
                column: "DeletedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Drivers_UserProfiles_UpdatedBy",
                table: "Drivers",
                column: "UpdatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
