using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveDefaultValuesFromNullableAuditFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Remove default values from nullable audit fields in Drivers table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Drivers",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Drivers",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            // Remove default values from nullable audit fields in Leagues table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Leagues",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Leagues",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            // Remove default values from nullable audit fields in Teams table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Teams",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Teams",
                type: "integer",
                nullable: true,
                defaultValue: null,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: 0);

            // Update any existing records with 0 values to NULL
            migrationBuilder.Sql(@"
                UPDATE ""Drivers"" SET ""DeletedBy"" = NULL WHERE ""DeletedBy"" = 0;
                UPDATE ""Drivers"" SET ""UpdatedBy"" = NULL WHERE ""UpdatedBy"" = 0;
                UPDATE ""Leagues"" SET ""DeletedBy"" = NULL WHERE ""DeletedBy"" = 0;
                UPDATE ""Leagues"" SET ""UpdatedBy"" = NULL WHERE ""UpdatedBy"" = 0;
                UPDATE ""Teams"" SET ""DeletedBy"" = NULL WHERE ""DeletedBy"" = 0;
                UPDATE ""Teams"" SET ""UpdatedBy"" = NULL WHERE ""UpdatedBy"" = 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Restore default values of 0 for nullable audit fields in Drivers table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Drivers",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Drivers",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);

            // Restore default values of 0 for nullable audit fields in Leagues table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Leagues",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Leagues",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);

            // Restore default values of 0 for nullable audit fields in Teams table
            migrationBuilder.AlterColumn<int>(
                name: "UpdatedBy",
                table: "Teams",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);

            migrationBuilder.AlterColumn<int>(
                name: "DeletedBy",
                table: "Teams",
                type: "integer",
                nullable: true,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true,
                oldDefaultValue: null);
        }
    }
}
