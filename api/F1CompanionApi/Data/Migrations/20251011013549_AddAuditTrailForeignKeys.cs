using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditTrailForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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

            migrationBuilder.CreateIndex(
                name: "IX_Teams_CreatedBy",
                table: "Teams",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_DeletedBy",
                table: "Teams",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Teams_UpdatedBy",
                table: "Teams",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Leagues_CreatedBy",
                table: "Leagues",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Leagues_DeletedBy",
                table: "Leagues",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_Leagues_UpdatedBy",
                table: "Leagues",
                column: "UpdatedBy");

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

            migrationBuilder.AddForeignKey(
                name: "FK_Leagues_UserProfiles_CreatedBy",
                table: "Leagues",
                column: "CreatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Leagues_UserProfiles_DeletedBy",
                table: "Leagues",
                column: "DeletedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Leagues_UserProfiles_UpdatedBy",
                table: "Leagues",
                column: "UpdatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_UserProfiles_CreatedBy",
                table: "Teams",
                column: "CreatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_UserProfiles_DeletedBy",
                table: "Teams",
                column: "DeletedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_UserProfiles_UpdatedBy",
                table: "Teams",
                column: "UpdatedBy",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_CreatedBy",
                table: "Drivers");

            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_DeletedBy",
                table: "Drivers");

            migrationBuilder.DropForeignKey(
                name: "FK_Drivers_UserProfiles_UpdatedBy",
                table: "Drivers");

            migrationBuilder.DropForeignKey(
                name: "FK_Leagues_UserProfiles_CreatedBy",
                table: "Leagues");

            migrationBuilder.DropForeignKey(
                name: "FK_Leagues_UserProfiles_DeletedBy",
                table: "Leagues");

            migrationBuilder.DropForeignKey(
                name: "FK_Leagues_UserProfiles_UpdatedBy",
                table: "Leagues");

            migrationBuilder.DropForeignKey(
                name: "FK_Teams_UserProfiles_CreatedBy",
                table: "Teams");

            migrationBuilder.DropForeignKey(
                name: "FK_Teams_UserProfiles_DeletedBy",
                table: "Teams");

            migrationBuilder.DropForeignKey(
                name: "FK_Teams_UserProfiles_UpdatedBy",
                table: "Teams");

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

            migrationBuilder.DropIndex(
                name: "IX_Teams_CreatedBy",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Teams_DeletedBy",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Teams_UpdatedBy",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Leagues_CreatedBy",
                table: "Leagues");

            migrationBuilder.DropIndex(
                name: "IX_Leagues_DeletedBy",
                table: "Leagues");

            migrationBuilder.DropIndex(
                name: "IX_Leagues_UpdatedBy",
                table: "Leagues");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_CreatedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_DeletedBy",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Drivers_UpdatedBy",
                table: "Drivers");
        }
    }
}
