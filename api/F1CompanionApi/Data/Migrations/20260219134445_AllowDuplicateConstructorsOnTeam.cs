using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AllowDuplicateConstructorsOnTeam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TeamConstructors_TeamId_ConstructorId",
                table: "TeamConstructors");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_TeamId_ConstructorId",
                table: "TeamConstructors",
                columns: new[] { "TeamId", "ConstructorId" },
                unique: true);
        }
    }
}
