using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceHasSprintWithWeekendFormat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WeekendFormat",
                table: "RaceWeekends",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.Sql(
                @"UPDATE ""RaceWeekends"" SET ""WeekendFormat"" = 1 WHERE ""HasSprint"" = true;
                  UPDATE ""RaceWeekends"" SET ""WeekendFormat"" = 0 WHERE ""HasSprint"" = false;"
            );

            migrationBuilder.DropColumn(
                name: "HasSprint",
                table: "RaceWeekends");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WeekendFormat",
                table: "RaceWeekends");

            migrationBuilder.AddColumn<bool>(
                name: "HasSprint",
                table: "RaceWeekends",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
