using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace F1CompanionApi.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTeamDriverAndConstructorSelections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TeamConstructors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    ConstructorId = table.Column<int>(type: "integer", nullable: false),
                    SlotPosition = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamConstructors", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamConstructors_Constructors_ConstructorId",
                        column: x => x.ConstructorId,
                        principalTable: "Constructors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamConstructors_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamConstructors_UserProfiles_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamConstructors_UserProfiles_DeletedBy",
                        column: x => x.DeletedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamConstructors_UserProfiles_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TeamDrivers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TeamId = table.Column<int>(type: "integer", nullable: false),
                    DriverId = table.Column<int>(type: "integer", nullable: false),
                    SlotPosition = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<int>(type: "integer", nullable: false),
                    UpdatedBy = table.Column<int>(type: "integer", nullable: true),
                    DeletedBy = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamDrivers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TeamDrivers_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamDrivers_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TeamDrivers_UserProfiles_CreatedBy",
                        column: x => x.CreatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamDrivers_UserProfiles_DeletedBy",
                        column: x => x.DeletedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TeamDrivers_UserProfiles_UpdatedBy",
                        column: x => x.UpdatedBy,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_ConstructorId",
                table: "TeamConstructors",
                column: "ConstructorId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_CreatedBy",
                table: "TeamConstructors",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_DeletedBy",
                table: "TeamConstructors",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_TeamId_ConstructorId",
                table: "TeamConstructors",
                columns: new[] { "TeamId", "ConstructorId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_TeamId_SlotPosition",
                table: "TeamConstructors",
                columns: new[] { "TeamId", "SlotPosition" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamConstructors_UpdatedBy",
                table: "TeamConstructors",
                column: "UpdatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_CreatedBy",
                table: "TeamDrivers",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_DeletedBy",
                table: "TeamDrivers",
                column: "DeletedBy");

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_DriverId",
                table: "TeamDrivers",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_TeamId_DriverId",
                table: "TeamDrivers",
                columns: new[] { "TeamId", "DriverId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_TeamId_SlotPosition",
                table: "TeamDrivers",
                columns: new[] { "TeamId", "SlotPosition" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TeamDrivers_UpdatedBy",
                table: "TeamDrivers",
                column: "UpdatedBy");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamConstructors");

            migrationBuilder.DropTable(
                name: "TeamDrivers");
        }
    }
}
