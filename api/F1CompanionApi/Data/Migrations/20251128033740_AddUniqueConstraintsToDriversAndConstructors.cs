using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddUniqueConstraintsToDriversAndConstructors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Drivers_Abbreviation",
                table: "Drivers",
                column: "Abbreviation",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Constructors_Name",
                table: "Constructors",
                column: "Name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Drivers_Abbreviation",
                table: "Drivers");

            migrationBuilder.DropIndex(
                name: "IX_Constructors_Name",
                table: "Constructors");
        }
    }
}
