using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUserTeamRelationship : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Teams_UserId",
                table: "Teams",
                column: "UserId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Teams_UserProfiles_UserId",
                table: "Teams",
                column: "UserId",
                principalTable: "UserProfiles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Teams_UserProfiles_UserId",
                table: "Teams");

            migrationBuilder.DropIndex(
                name: "IX_Teams_UserId",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "Teams");
        }
    }
}
