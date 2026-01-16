using System;

namespace F1CompanionApi.Api.Models;

public class TeamResponse
{
    public required int Id { get; set; }
    public required string Name { get; set; }
    public required string OwnerName { get; set; }
}
