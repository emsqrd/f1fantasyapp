using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPriceToDriversAndConstructors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "Drivers",
                type: "numeric",
                nullable: false,
                defaultValue: 3000000m);

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "Constructors",
                type: "numeric",
                nullable: false,
                defaultValue: 3000000m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Price",
                table: "Drivers");

            migrationBuilder.DropColumn(
                name: "Price",
                table: "Constructors");
        }
    }
}
