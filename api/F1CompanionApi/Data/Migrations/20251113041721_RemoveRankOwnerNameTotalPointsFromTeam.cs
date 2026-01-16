using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRankOwnerNameTotalPointsFromTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OwnerName",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "Rank",
                table: "Teams");

            migrationBuilder.DropColumn(
                name: "TotalPoints",
                table: "Teams");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OwnerName",
                table: "Teams",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Rank",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalPoints",
                table: "Teams",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
